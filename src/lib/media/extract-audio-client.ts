'use client';

import { mediaFormatForExtension, extensionOf } from '@/lib/media/formats';

/**
 * Extracción de audio EN EL NAVEGADOR con ffmpeg.wasm, antes de subir.
 *
 * Un video/podcast de 40-50 min pesa cientos de MB y no cabe en el límite de
 * subida de Storage (50 MB en el plan gratuito de Supabase). Aquí el navegador
 * convierte cualquier audio/video a un MP3 mono de 16 kHz y 32 kbps —suficiente
 * para transcripción (Whisper trabaja a 16 kHz)— que para 50 min ronda los
 * 12 MB. El archivo original nunca se sube.
 *
 * El core de ffmpeg.wasm (~32 MB) se sirve desde `/public/ffmpeg/` (mismo
 * origen, sin CDN). El archivo de entrada se monta vía WORKERFS: ffmpeg lo lee
 * de forma perezosa desde el Blob, sin cargarlo entero en memoria.
 */

export type ExtractStage = 'loading' | 'extracting';

export interface PrepareMediaOptions {
  /** Audio por debajo de este tamaño se sube tal cual, sin ffmpeg.wasm. */
  skipExtractBelowBytes: number;
  onStage?: (stage: ExtractStage) => void;
  /** Progreso 0-100 (descarga del core mientras stage='loading', transcodificación mientras 'extracting'). */
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}

export interface PreparedMedia {
  file: File;
  /** true si se extrajo el audio; false si se devuelve el archivo original. */
  wasExtracted: boolean;
}

const OUTPUT_BITRATE_KBPS = 32;
const OUTPUT_SAMPLE_RATE = 16000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ffmpegPromise: Promise<any> | null = null;

async function getFfmpeg(onProgress?: (pct: number) => void) {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');
      const ffmpeg = new FFmpeg();
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
        toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm', true, ({ received, total }) => {
          // El servidor no siempre manda un Content-Length útil para el blob;
          // solo se reporta si los números tienen sentido.
          if (total > 0 && received >= 0 && received <= total) {
            onProgress?.(Math.round((received / total) * 100));
          }
        }),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
      return ffmpeg;
    })().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }
  return ffmpegPromise;
}

function baseName(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return (dot > 0 ? filename.slice(0, dot) : filename) || 'audio';
}

/**
 * ¿Hace falta pasar este archivo por ffmpeg.wasm antes de subir? Sí para todo
 * el video y para el audio que supere el umbral; no para el audio pequeño (se
 * sube tal cual). Función pura, sin dependencias del navegador.
 */
export function shouldExtractAudio(filename: string, sizeBytes: number, skipExtractBelowBytes: number): boolean {
  const isAudio = mediaFormatForExtension(extensionOf(filename))?.sourceType === 'audio';
  return !(isAudio && sizeBytes <= skipExtractBelowBytes);
}

/**
 * Devuelve el archivo listo para subir: el audio extraído (MP3) si el original
 * es un video o un audio grande, o el original tal cual si ya es un audio chico.
 * Si ffmpeg.wasm no está disponible o falla, lanza `AUDIO_EXTRACTION_CLIENT_FAILED`
 * (el llamador decide si subir el original o mostrar error).
 */
export async function prepareMediaForUpload(file: File, opts: PrepareMediaOptions): Promise<PreparedMedia> {
  const ext = extensionOf(file.name);

  if (!shouldExtractAudio(file.name, file.size, opts.skipExtractBelowBytes)) {
    return { file, wasExtracted: false };
  }

  opts.onStage?.('loading');
  opts.onProgress?.(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ffmpeg: any;
  try {
    ffmpeg = await getFfmpeg(opts.onProgress);
  } catch {
    throw new Error('AUDIO_EXTRACTION_CLIENT_FAILED');
  }

  if (opts.signal?.aborted) throw new Error('ABORTED');

  const { FFFSType } = await import('@ffmpeg/ffmpeg');
  const mountDir = '/in';
  const inputName = `source.${ext || 'bin'}`;
  const outputName = 'out.mp3';

  const onProgress = ({ progress }: { progress: number }) => {
    opts.onProgress?.(Math.min(100, Math.max(0, Math.round(progress * 100))));
  };
  ffmpeg.on('progress', onProgress);

  const abortHandler = () => {
    try {
      ffmpeg.terminate();
    } catch {
      /* noop */
    }
    ffmpegPromise = null;
  };
  opts.signal?.addEventListener('abort', abortHandler, { once: true });

  try {
    opts.onStage?.('extracting');
    opts.onProgress?.(0);

    try {
      await ffmpeg.createDir(mountDir);
    } catch {
      /* ya existe */
    }
    await ffmpeg.mount(FFFSType.WORKERFS, { blobs: [{ name: inputName, data: file }] }, mountDir);

    const code = await ffmpeg.exec([
      '-i',
      `${mountDir}/${inputName}`,
      '-vn',
      '-ac',
      '1',
      '-ar',
      String(OUTPUT_SAMPLE_RATE),
      '-c:a',
      'libmp3lame',
      '-b:a',
      `${OUTPUT_BITRATE_KBPS}k`,
      '-f',
      'mp3',
      outputName,
    ]);

    if (code !== 0) throw new Error('AUDIO_EXTRACTION_CLIENT_FAILED');

    const data = (await ffmpeg.readFile(outputName)) as Uint8Array;
    if (!data || data.byteLength === 0) throw new Error('AUDIO_EXTRACTION_CLIENT_FAILED');

    const outFile = new File([data as BlobPart], `${baseName(file.name)}.mp3`, { type: 'audio/mpeg' });
    return { file: outFile, wasExtracted: true };
  } catch (error) {
    if (error instanceof Error && (error.message === 'ABORTED' || opts.signal?.aborted)) {
      throw new Error('ABORTED');
    }
    throw new Error('AUDIO_EXTRACTION_CLIENT_FAILED');
  } finally {
    ffmpeg.off?.('progress', onProgress);
    opts.signal?.removeEventListener('abort', abortHandler);
    try {
      await ffmpeg.unmount(mountDir);
    } catch {
      /* noop */
    }
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      /* noop */
    }
  }
}
