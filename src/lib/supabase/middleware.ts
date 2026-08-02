import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/types/database';

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/auth/callback', '/reset-password'];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return pathname.startsWith('/_next') || pathname.startsWith('/api/public');
}

/**
 * Las invocaciones de Server Actions son POST a la misma URL de la página,
 * identificadas por el header `Next-Action`. Si el middleware responde con un
 * redirect a una de estas peticiones, Next.js no puede interpretar la
 * respuesta ("An unexpected response was received from the server") en vez de
 * mostrar un error de sesión manejable. Las Server Actions ya validan el
 * usuario internamente y devuelven un `ActionResult` de error, así que el
 * middleware debe dejarlas pasar en vez de redirigir.
 */
function isServerActionRequest(request: NextRequest) {
  return request.headers.has('next-action');
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (isServerActionRequest(request)) {
    return supabaseResponse;
  }

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}
