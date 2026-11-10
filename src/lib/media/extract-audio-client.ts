'use client';

import { mediaFormatForExtension, extensionOf } from '@/lib/media/formats';

/**
 * Preparación del archivo EN EL NAVEGADOR antes de subirlo, con ffmpeg.wasm.
 *
 * Un video/podcast de 40-50 min pesa cientos de MB y no cabe en el límite de
 * subida de Storage (50 MB en el plan gratuito de Supabase). Para no subir el
 * original, el navegador saca el audio. Hay tres caminos, del más rápido al más
 * lento:
 *
 * 1. SUBIDA DIRECTA: un video MP4/WebM chico (≤ 20 MB) o un audio chico se sube
 *    tal cual, sin cargar ffmpeg.wasm (el servidor extrae el audio).
 * 2. COPIA RÁPIDA ("remux"): en un video se copia la pista de audio SIN
 *    recomprimirla. Tarda segundos en vez de minutos. Solo se usa si el audio
 *    resultante cabe en una petición del proveedor de transcripción (25 MB), para
 *    que el servidor no tenga que trocearlo.
 * 3. RECOMPRESIÓN: el camino de siempre. Convierte a MP3 mono de 16 kHz y 32 kbps
 *    —suficiente para transcripción (Whisper trabaja a 16 kHz)—, que para 50 min
 *    ronda los 12 MB. Es lento (ffmpeg.wasm corre en un solo hilo), así que solo
 *    se usa cuando los caminos anteriores no sirven.
 *
 * El core de ffmpeg.wasm (~32 MB) se sirve desde `/public/ffmpeg/` (mismo
 * origen, sin CDN) con caché larga (ver next.config.mjs). El archivo de entrada
 * se monta vía WORKERFS: ffmpeg lo lee de forma perezosa desde el Blob, sin
 * cargarlo entero en memoria.
 */

export type ExtractStage = 'loading' | 'extracting';

export interface PrepareMediaOptions {
  /** Audio por debajo de este tamaño se sube tal cual, sin ffmpeg.wasm. */
  skipExtractBelowBytes: number;
  /**
   * Tamaño máximo (bytes) del audio copiado sin recomprimir (camino rápido). Si lo
   * supera, se recomprime a MP3. Por defecto, el límite por petición del proveedor.
   */
  remuxMaxBytes?: number;
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

const MB = 1024 * 1024;
const OUTPUT_BITRATE_KBPS = 32;
const OUTPUT_SAMPLE_RATE = 16000;

/** Un video de estos formatos y de hasta este tamaño se sube tal cual (los proveedores los aceptan directo). */
export const DIRECT_VIDEO_EXTENSIONS: ReadonlySet<string> = new Set(['mp4', 'webm']);
export const DIRECT_VIDEO_MAX_BYTES = 20 * MB;

/** Límite por petición de las APIs de transcripción (Whisper/Groq): la copia rápida debe caber en él. */
const DEFAULT_REMUX_MAX_BYTES = 25 * MB;

/** Contenedor de salida para copiar la pista de audio según el formato del video. */
const REMUX_TARGETS: Record<string, { extension: string; mimeType: string }> = {
  mp4: { extension: 'm4a', mimeType: 'audio/mp4' },
  m4v: { extension: 'm4a', mimeType: 'audio/mp4' },
  mov: { extension: 'm4a', mimeType: 'audio/mp4' },
  mkv: { extension: 'm4a', mimeType: 'audio/mp4' },
  webm: { extension: 'webm', mimeType: 'audio/webm' },
};

/** Contenedor al que copiar el audio de un video con esa extensión, o `null` si no hay copia rápida para él. */
export function remuxTargetFor(extension: string): { extension: string; mimeType: string } | null {
  return REMUX_TARGETS[extension.toLowerCase()] ?? null;
}

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
 * ¿Hace falta pasar este archivo por ffmpeg.wasm antes de subir? No para el
 * audio chico ni para un video MP4/WebM chico (se suben tal cual); sí para el
 * resto. Función pura, sin dependencias del navegador.
 */
export function shouldExtractAudio(
  filename: string,
  sizeBytes: number,
  skipExtractBelowBytes: number,
  directVideoMaxBytes: number = DIRECT_VIDEO_MAX_BYTES,
): boolean {
  const extension = extensionOf(filename);
  const format = mediaFormatForExtension(extension);
  if (format?.sourceType === 'audio') return sizeBytes > skipExtractBelowBytes;
  if (format?.sourceType === 'video' && DIRECT_VIDEO_EXTENSIONS.has(extension)) return sizeBytes > directVideoMaxBytes;
  return true;
}

interface FfmpegLike {
  exec(args: string[]): Promise<number>;
  readFile(name: string): Promise<unknown>;
  deleteFile(name: string): Promise<unknown>;
}

/**
 * Camino rápido: copia la pista de audio del video SIN recomprimirla. Devuelve
 * `null` (y el llamador recomprime) si no hay copia posible para ese formato,
 * si el códec no cabe en el contenedor, si falla, o si el resultado supera
 * `maxBytes`.
 */
async function tryRemuxAudio(
  ffmpeg: FfmpegLike,
  mountDir: string,
  inputName: string,
  file: File,
  maxBytes: number,
): Promise<File | null> {
  const target = remuxTargetFor(extensionOf(file.name));
  if (!target) return null;

  const outputName = `remux.${target.extension}`;
  try {
    const code = await ffmpeg.exec(['-i', `${mountDir}/${inputName}`, '-vn', '-c:a', 'copy', outputName]);
    if (code !== 0) return null;

    const data = (await ffmpeg.readFile(outputName)) as Uint8Array;
    if (!data || data.byteLength === 0 || data.byteLength > maxBytes) return null;

    return new File([data as BlobPart], `${baseName(file.name)}.${target.extension}`, { type: target.mimeType });
  } catch {
    return null;
  } finally {
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      /* noop */
    }
  }
}

/**
 * Devuelve el archivo listo para subir: el original si es chico, el audio
 * copiado sin recomprimir (camino rápido) o el audio recomprimido a MP3. Si
 * ffmpeg.wasm no está disponible o falla, lanza `AUDIO_EXTRACTION_CLIENT_FAILED`
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

    // Camino rápido solo para video: un audio ya es audio, y recomprimirlo lo achica.
    if (mediaFormatForExtension(ext)?.sourceType === 'video') {
      const remuxed = await tryRemuxAudio(ffmpeg, mountDir, inputName, file, opts.remuxMaxBytes ?? DEFAULT_REMUX_MAX_BYTES);
      if (remuxed) {
        opts.onProgress?.(100);
        return { file: remuxed, wasExtracted: true };
      }
      if (opts.signal?.aborted) throw new Error('ABORTED');
      opts.onProgress?.(0);
    }

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
