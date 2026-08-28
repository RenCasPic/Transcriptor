import { spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import path from 'node:path';

/**
 * Resuelve la ruta al binario de yt-dlp. Orden:
 *  1. `YTDLP_PATH` (para despliegues que lo instalan por su cuenta, p. ej. un
 *     worker con `pip install -U yt-dlp`).
 *  2. `bin/yt-dlp` (`bin/yt-dlp.exe` en Windows) — lo descarga
 *     `scripts/setup-ytdlp.mjs` en postinstall/prebuild. Es el camino normal
 *     en Vercel (el binario va en el bundle vía `outputFileTracingIncludes`).
 *  3. `yt-dlp` del PATH del sistema.
 *
 * Devuelve `null` si no encuentra ninguno ejecutable, para que el llamador
 * lance un error accionable (`AUDIO_EXTRACTOR_UNAVAILABLE`) en vez de un
 * ENOENT crudo.
 */
let cached: string | null | undefined;

export async function resolveYtDlpBinary(): Promise<string | null> {
  if (cached !== undefined) return cached;

  const candidates: string[] = [];
  if (process.env.YTDLP_PATH) candidates.push(process.env.YTDLP_PATH);
  const localName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  candidates.push(path.join(process.cwd(), 'bin', localName));

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      cached = candidate;
      return cached;
    } catch {
      /* siguiente candidato */
    }
  }

  // Último recurso: el PATH del sistema.
  if (await canRun('yt-dlp')) {
    cached = 'yt-dlp';
    return cached;
  }

  cached = null;
  return cached;
}

/** Solo para tests: reinicia la caché de resolución. */
export function resetYtDlpBinaryCache(): void {
  cached = undefined;
}

function canRun(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(bin, ['--version'], { stdio: 'ignore' });
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}
