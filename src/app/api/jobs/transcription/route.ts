import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processTranscriptionJob } from '@/lib/generation/transcription-job-runner';

export const runtime = 'nodejs';
// Techo alto para el troceado + transcripción de archivos grandes. La
// plataforma de despliegue puede recortarlo; el job queda en `processing` y
// una llamada posterior a este mismo endpoint lo retoma (idempotente).
export const maxDuration = 300;

const MAX_DRAIN_PER_CALL = 3;
// Un job "processing" más viejo que esto se considera colgado (p. ej. la
// función serverless que lo lanzó vía after() fue terminada) y se vuelve a
// tomar.
const STALE_PROCESSING_MS = 15 * 60 * 1000;

/**
 * Worker/cron seam. Un cron externo (Vercel Cron, GitHub Actions, etc.) hace
 * `POST` aquí con la cabecera `x-jobs-secret` para drenar los jobs de
 * transcripción `queued` (y retomar los `processing` colgados). El mismo
 * `processTranscriptionJob` que usa `after()` — mover el procesamiento a un
 * worker real es cambiar quién llama a esto, no cómo funciona.
 *
 * Sin `JOBS_WORKER_SECRET` configurado, el endpoint está deshabilitado (el
 * flujo sigue funcionando vía `after()`).
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.JOBS_WORKER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'worker_disabled' }, { status: 503 });
  }
  if (request.headers.get('x-jobs-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { jobId?: unknown };
  const supabase = createAdminClient();

  if (typeof body.jobId === 'string') {
    const { data } = await supabase
      .from('generation_jobs')
      .select('project_id')
      .eq('id', body.jobId)
      .maybeSingle();
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const result = await processTranscriptionJob(body.jobId, data.project_id);
    return NextResponse.json(result);
  }

  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  const { data: pending } = await supabase
    .from('generation_jobs')
    .select('id, project_id, status, started_at')
    .eq('job_type', 'transcribe')
    .in('status', ['queued', 'processing'])
    .order('created_at', { ascending: true })
    .limit(MAX_DRAIN_PER_CALL * 4);

  const runnable = (pending ?? [])
    .filter((job) => job.status === 'queued' || (job.started_at ?? '') < staleBefore)
    .slice(0, MAX_DRAIN_PER_CALL);

  const results = [];
  for (const job of runnable) {
    results.push(await processTranscriptionJob(job.id, job.project_id));
  }

  return NextResponse.json({ processed: results.length, results });
}
