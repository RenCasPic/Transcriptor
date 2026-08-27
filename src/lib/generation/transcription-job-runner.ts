import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { runTranscriptionJob, type TranscriptionJobResult } from './transcription-pipeline';

/**
 * Envoltura de transporte de `runTranscriptionJob`: usa el cliente admin
 * (el job ya pasó la autorización RLS al encolarse; el procesamiento en
 * segundo plano no tiene sesión de usuario) y revalida las rutas afectadas al
 * terminar. La invocan tanto la Server Action vía `after()` como el Route
 * Handler del worker (`/api/jobs/transcription`).
 */
export async function processTranscriptionJob(
  jobId: string,
  projectId: string,
): Promise<TranscriptionJobResult> {
  const supabase = createAdminClient();
  const result = await runTranscriptionJob(supabase, { jobId });
  try {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/editor`);
    revalidatePath('/dashboard');
  } catch {
    // revalidatePath puede no estar disponible fuera de un contexto de
    // request (p. ej. tests); no es crítico para el resultado del job.
  }
  return result;
}
