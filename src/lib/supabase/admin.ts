import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

/**
 * Cliente con service role key. SOLO puede importarse desde código que se ejecuta
 * en el servidor (Server Actions, Route Handlers, scripts). Nunca importar desde
 * un archivo marcado con 'use client' ni exponer el resultado al navegador.
 *
 * Se usa exclusivamente para operaciones administrativas que deben saltarse RLS,
 * como la generación de URLs firmadas o tareas de mantenimiento internas.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient no debe ejecutarse en el navegador.');
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
