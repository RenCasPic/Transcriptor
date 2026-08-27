'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';
import { getTranscriptionJobById, type TranscriptionJobStatus } from '@/lib/data/jobs';

const JobStatusSchema = z.object({ jobId: z.string().uuid() });

/**
 * Consulta el estado de un job de transcripción. La usa el poller del cliente
 * para mostrar el progreso (subiendo → procesando → transcribiendo →
 * generando → completado/error) y para poder recuperar el estado si el
 * usuario abandona la página y vuelve. Sujeta a RLS: solo devuelve jobs de
 * proyectos del workspace del usuario.
 */
export async function getJobStatusAction(
  input: z.infer<typeof JobStatusSchema>,
): Promise<ActionResult<TranscriptionJobStatus>> {
  const parsed = JobStatusSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Datos inválidos.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err('UNAUTHENTICATED', 'Debes iniciar sesión.');

  const job = await getTranscriptionJobById(parsed.data.jobId);
  if (!job) return err('NOT_FOUND', 'No se encontró el procesamiento.');

  return ok(job);
}
