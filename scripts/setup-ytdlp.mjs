// Descarga el binario de yt-dlp a ./bin/ para la extracción de audio de
// YouTube (ver src/lib/integrations/audio-extractor/ytdlp-extractor.ts). Se
// ejecuta en `postinstall` y antes de `build`/`dev`; el binario NO se
// versiona (está en .gitignore, igual que el core de ffmpeg.wasm).
//
// yt-dlp es la única vía que sigue funcionando para bajar audio de YouTube
// (las librerías JS puras quedaron obsoletas con SABR). Se actualiza a
// menudo: si la extracción empieza a fallar, sube YTDLP_VERSION a la última
// release (https://github.com/yt-dlp/yt-dlp/releases) o pon YTDLP_VERSION=latest.
import { chmod, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const binDir = path.join(root, 'bin');

// Versión fijada por defecto (reproducible en CI/Vercel, sin pegarle a la API
// de GitHub en cada build). Súbela cuando YouTube rompa la extracción.
const PINNED_VERSION = '2026.08.19';
const requestedVersion = process.env.YTDLP_VERSION || PINNED_VERSION;

const ASSET_BY_PLATFORM = {
  'win32-x64': 'yt-dlp.exe',
  'linux-x64': 'yt-dlp_linux',
  'linux-arm64': 'yt-dlp_linux_aarch64',
  'darwin-x64': 'yt-dlp_macos',
  'darwin-arm64': 'yt-dlp_macos',
};

const key = `${process.platform}-${process.arch}`;
const asset = ASSET_BY_PLATFORM[key];
const outName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const outPath = path.join(binDir, outName);
const markerPath = path.join(binDir, '.yt-dlp-version');

async function resolveVersion() {
  if (requestedVersion !== 'latest') return requestedVersion;
  const res = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
    headers: { 'user-agent': 'transcriptor-setup' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const json = await res.json();
  return json.tag_name;
}

async function alreadyInstalled(version) {
  try {
    await stat(outPath);
    const marker = await readFile(markerPath, 'utf8').catch(() => '');
    return marker.trim() === version;
  } catch {
    return false;
  }
}

async function main() {
  if (!asset) {
    console.warn(`[setup-ytdlp] plataforma no soportada (${key}); se omite. Define YTDLP_PATH para usar un binario propio.`);
    return;
  }

  const version = await resolveVersion();

  if (await alreadyInstalled(version)) {
    console.log(`[setup-ytdlp] yt-dlp ${version} ya presente en bin/`);
    return;
  }

  const url = `https://github.com/yt-dlp/yt-dlp/releases/download/${version}/${asset}`;
  console.log(`[setup-ytdlp] descargando ${asset} (${version})...`);

  await mkdir(binDir, { recursive: true });
  const res = await fetch(url, { headers: { 'user-agent': 'transcriptor-setup' } });
  if (!res.ok || !res.body) throw new Error(`descarga falló: HTTP ${res.status} ${url}`);

  await pipeline(Readable.fromWeb(res.body), createWriteStream(outPath));
  await chmod(outPath, 0o755);
  await writeFile(markerPath, `${version}\n`);
  console.log(`[setup-ytdlp] yt-dlp ${version} -> ${path.relative(root, outPath)}`);
}

main().catch((error) => {
  // No romper install/build: la app degrada a "sube el archivo tal cual" si
  // el binario no está (getAudioExtractor lanza AUDIO_EXTRACTOR_UNAVAILABLE,
  // que el frontend traduce a un mensaje accionable).
  console.warn('[setup-ytdlp] no se pudo instalar yt-dlp:', error.message);
  console.warn('[setup-ytdlp] la importación de YouTube SIN subtítulos no funcionará hasta resolverlo.');
  process.exit(0);
});
