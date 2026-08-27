import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

/**
 * Resuelve las rutas a los binarios de ffmpeg/ffprobe. Usa los paquetes
 * `@ffmpeg-installer/ffmpeg` / `@ffprobe-installer/ffprobe` (binarios
 * estáticos, sin dependencia del sistema) y, si no están, cae a
 * `FFMPEG_PATH` / `FFPROBE_PATH` o al binario del PATH. Se importa de forma
 * dinámica para que Next.js no intente empaquetar los binarios (mismo motivo
 * que `@distube/ytdl-core` en `serverExternalPackages`).
 */
export async function resolveFfmpegBinaries(): Promise<{ ffmpeg: string; ffprobe: string } | null> {
  let ffmpeg: string | null = process.env.FFMPEG_PATH ?? null;
  let ffprobe: string | null = process.env.FFPROBE_PATH ?? null;

  if (!ffmpeg) {
    try {
      const mod = (await import('@ffmpeg-installer/ffmpeg')) as { path?: string; default?: { path?: string } };
      ffmpeg = mod.path ?? mod.default?.path ?? null;
    } catch {
      ffmpeg = null;
    }
  }
  if (!ffprobe) {
    try {
      const mod = (await import('@ffprobe-installer/ffprobe')) as { path?: string; default?: { path?: string } };
      ffprobe = mod.path ?? mod.default?.path ?? null;
    } catch {
      ffprobe = null;
    }
  }

  // Último recurso: confiar en que estén en el PATH del sistema.
  ffmpeg ??= 'ffmpeg';
  ffprobe ??= 'ffprobe';

  const ok = await canRun(ffmpeg, ['-version']);
  if (!ok) return null;
  return { ffmpeg, ffprobe };
}

function canRun(bin: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(bin, args, { stdio: 'ignore' });
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

function run(bin: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`FFMPEG_EXIT_${code}:${stderr.slice(-500)}`));
    });
  });
}

export async function probeDurationSeconds(ffprobe: string, filePath: string): Promise<number> {
  const { stdout } = await run(ffprobe, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const duration = Number(stdout.trim());
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

export interface FfmpegSegmentOptions {
  segmentSeconds: number;
  audioBitrateKbps: number;
}

/** Escribe un stream a un archivo temporal (en disco, no en memoria). */
export async function streamToTempFile(
  stream: NodeJS.ReadableStream,
  dir: string,
  filename: string,
): Promise<string> {
  const filePath = path.join(dir, filename);
  await pipeline(stream, createWriteStream(filePath));
  return filePath;
}

export async function makeTempDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'transcriptor-chunk-'));
}

export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true }).catch(() => {});
}

/**
 * Trocea el audio de `inputPath` en archivos mp3 mono de `segmentSeconds`
 * cada uno, en `outDir`. ffmpeg procesa el archivo de forma secuencial
 * (streaming interno): no carga el video entero en memoria. Devuelve las
 * rutas de los segmentos en orden.
 */
export async function segmentAudio(
  ffmpeg: string,
  inputPath: string,
  outDir: string,
  options: FfmpegSegmentOptions,
): Promise<string[]> {
  const pattern = path.join(outDir, 'chunk_%05d.mp3');
  await run(ffmpeg, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '1',
    '-c:a',
    'libmp3lame',
    '-b:a',
    `${options.audioBitrateKbps}k`,
    '-f',
    'segment',
    '-segment_time',
    String(options.segmentSeconds),
    '-reset_timestamps',
    '1',
    pattern,
  ]);

  const files = (await readdir(outDir))
    .filter((f) => /^chunk_\d+\.mp3$/.test(f))
    .sort();
  return files.map((f) => path.join(outDir, f));
}

export async function readFileAsBlob(filePath: string, mimeType: string): Promise<Blob> {
  const buffer = await readFile(filePath);
  return new Blob([new Uint8Array(buffer)], { type: mimeType });
}
