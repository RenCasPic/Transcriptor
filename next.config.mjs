import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Evita que Next.js confunda la raíz del workspace cuando hay otro
  // package-lock.json en un directorio superior (p. ej. el perfil del usuario).
  outputFileTracingRoot: __dirname,
  // @distube/ytdl-core es una librería pesada orientada a Node (streams,
  // scraping) que webpack no debe intentar empaquetar: el mismo tipo de
  // bundling rompió isomorphic-dompurify/jsdom en el bundle "action-browser"
  // de las Server Actions (ENOENT buscando un asset que no existe ahí).
  // Mantenerla externa evita repetir ese problema.
  serverExternalPackages: ['@distube/ytdl-core'],
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
