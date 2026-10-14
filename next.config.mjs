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
  // Paquetes con binarios/streams orientados a Node que webpack no debe
  // intentar empaquetar. @ffmpeg-installer/@ffprobe-installer traen binarios
  // estáticos que se cargan por ruta en tiempo de ejecución (troceado de
  // audio de archivos grandes, ver src/lib/media/audio-chunker).
  serverExternalPackages: [
    '@distube/ytdl-core',
    '@ffmpeg-installer/ffmpeg',
    '@ffprobe-installer/ffprobe',
  ],
  // El binario de yt-dlp (bin/yt-dlp, descargado por scripts/setup-ytdlp.mjs)
  // se invoca por spawn, no por import: Next.js no lo detecta con el trazado
  // automático, así que hay que incluirlo a mano en el bundle de las rutas
  // que extraen audio de YouTube (la Server Action transcribeYoutubeAudioAction
  // se usa desde el Dashboard y desde la página de un proyecto).
  outputFileTracingIncludes: {
    '/dashboard': ['./bin/**'],
    '/projects/**': ['./bin/**'],
  },
  experimental: {
    serverActions: {
      // Los archivos de audio/video NO pasan por Server Actions: el navegador
      // los sube directo a Supabase Storage (signed upload URL) y la acción
      // solo recibe metadata. Este límite cubre payloads normales de
      // formularios/JSON.
      bodySizeLimit: '4mb',
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
