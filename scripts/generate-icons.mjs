// Script de un solo uso para generar los íconos placeholder de la PWA.
// Usa `sharp`, que ya está disponible como dependencia opcional de Next.js
// (optimización de imágenes); no se agrega como dependencia formal del
// proyecto porque no se necesita en tiempo de ejecución.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });

const BRAND_COLOR = { r: 79, g: 70, b: 229, alpha: 1 }; // #4f46e5

function svgIcon(size) {
  const radius = size * 0.18;
  return Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" fill="#4f46e5"/>
      <text x="50%" y="54%" font-family="Arial, sans-serif" font-weight="bold"
        font-size="${size * 0.42}" fill="white" text-anchor="middle" dominant-baseline="middle">T</text>
    </svg>
  `);
}

async function generate(size, outPath) {
  await sharp(svgIcon(size)).png().toFile(outPath);
  console.log('Generado:', outPath);
}

await generate(192, 'public/icons/icon-192.png');
await generate(512, 'public/icons/icon-512.png');
await sharp(svgIcon(64)).png().toFile('src/app/icon.png');
console.log('Generado: src/app/icon.png');
