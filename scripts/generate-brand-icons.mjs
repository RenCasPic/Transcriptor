/**
 * Genera los íconos de TalkToPost a partir del símbolo (SVG de 64x64):
 *   - src/app/icon.svg          favicon vectorial (trazos engrosados: se ve a 16-32 px)
 *   - src/app/icon.png          favicon PNG 64x64 (trazos engrosados)
 *   - src/app/apple-icon.png    180x180, símbolo sobre fondo blanco (iOS no admite transparencia)
 *   - public/icons/icon-192.png y icon-512.png   íconos del manifest (fondo transparente)
 *
 * Uso (CMD):  node scripts/generate-brand-icons.mjs
 * Usa `sharp` (ya viene con Next.js). Los trazos son los mismos de
 * src/components/brand/logo-mark.tsx: si cambias el símbolo, cámbialo en los dos.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Strokes: `compact` (≤ 32 px) engrosa los trazos para que se lean al reducir. */
function symbolInner({ compact }) {
  const wave = compact ? 4 : 3.2;
  const line = compact ? 4.6 : 3.4;
  return (
    `<circle cx="32" cy="32" r="29" fill="#4F46E5"/>` +
    `<path d="M11 32L14 26L17.5 38L21 22L24.5 38L28 28L30.5 32" stroke="#FBBF24" stroke-width="${wave}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
    `<path d="M30.5 32H52M47.5 27.5L52 32L47.5 36.5M35 24H44M35 40H40" stroke="#FFFFFF" stroke-width="${line}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  );
}

const svg = ({ compact }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${symbolInner({ compact })}</svg>`;

/** Símbolo centrado sobre un fondo sólido (para el apple-icon). */
const svgOnBackground = ({ compact, background, scale }) => {
  const offset = (64 - 64 * scale) / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" fill="${background}"/>` +
    `<g transform="translate(${offset} ${offset}) scale(${scale})">${symbolInner({ compact })}</g>` +
    `</svg>`
  );
};

async function png(file, svgString, size) {
  const out = path.join(root, file);
  await mkdir(path.dirname(out), { recursive: true });
  // `density` alto para que el SVG se rasterice nítido al tamaño final.
  await sharp(Buffer.from(svgString), { density: Math.max(72, (size / 64) * 72 * 2) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log('✓', file, `${size}x${size}`);
}

await writeFile(path.join(root, 'src/app/icon.svg'), svg({ compact: true }) + '\n');
console.log('✓ src/app/icon.svg');

await png('src/app/icon.png', svg({ compact: true }), 64);
await png('src/app/apple-icon.png', svgOnBackground({ compact: false, background: '#FFFFFF', scale: 0.84 }), 180);
await png('public/icons/icon-192.png', svg({ compact: false }), 192);
await png('public/icons/icon-512.png', svg({ compact: false }), 512);
