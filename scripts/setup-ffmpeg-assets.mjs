// Copia el core de ffmpeg.wasm (~32 MB) a public/ffmpeg/ para servirlo desde
// el mismo origen (sin CDN, sin problemas de CSP y offline-friendly). Se
// ejecuta en `postinstall` y antes de `build`; los archivos NO se versionan.
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, '..', 'public', 'ffmpeg');

const ASSETS = [
  { specifier: '@ffmpeg/core', out: 'ffmpeg-core.js' },
  { specifier: '@ffmpeg/core/wasm', out: 'ffmpeg-core.wasm' },
];

async function main() {
  await mkdir(outDir, { recursive: true });
  let copied = 0;
  for (const asset of ASSETS) {
    let src;
    try {
      src = require.resolve(asset.specifier);
    } catch {
      console.warn(`[setup-ffmpeg-assets] no se pudo resolver ${asset.specifier} (¿falta @ffmpeg/core?) — se omite.`);
      continue;
    }
    await copyFile(src, path.join(outDir, asset.out));
    copied += 1;
  }
  console.log(`[setup-ffmpeg-assets] ${copied}/${ASSETS.length} archivos en public/ffmpeg/`);
  if (copied < ASSETS.length) {
    console.warn('[setup-ffmpeg-assets] la extracción de audio en el navegador degradará a "subir el archivo tal cual".');
  }
}

main().catch((error) => {
  console.error('[setup-ffmpeg-assets] error:', error);
  // No romper el install/build por esto: la extracción de audio en el
  // navegador degrada a "sube el archivo tal cual" si el core no está.
  process.exit(0);
});
