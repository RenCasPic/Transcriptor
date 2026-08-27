import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Excluye assets estáticos y el core de ffmpeg.wasm (`/public/ffmpeg/*`,
    // ~32 MB): no deben pasar por la comprobación de sesión.
    '/((?!_next/static|_next/image|favicon.ico|ffmpeg/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|ico|txt|xml|json|wasm|m4a|mp3|mp4)$).*)',
  ],
};
