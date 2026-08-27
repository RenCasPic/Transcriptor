'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { runArticleGenerationPipeline } from '@/lib/generation/pipeline';
import { checkRateLimit } from '@/lib/rate-limit';
import { ok, err, type ActionResult } from '@/lib/types/domain';

const GENERATION_RATE_LIMIT = 5;
const GENERATION_RATE_WINDOW_SECONDS = 60 * 10;

export async function generateArticleAction(projectId: string): Promise<ActionResult<{ documentId: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err('UNAUTHENTICATED', 'Debes iniciar sesión.');
  }

  const rateLimit = checkRateLimit(`generate-article:${user.id}`, GENERATION_RATE_LIMIT, GENERATION_RATE_WINDOW_SECONDS);
  if (!rateLimit.allowed) {
    return err(
      'RATE_LIMITED',
      `Alcanzaste el límite de generaciones. Inténtalo de nuevo en ${rateLimit.retryAfterSeconds} segundos.`,
    );
  }

  const { data: job } = await supabase
    .from('generation_jobs')
    .insert({
      project_id: projectId,
      job_type: 'generate_article',
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  await supabase.from('projects').update({ status: 'processing' }).eq('id', projectId);

  try {
    const result = await runArticleGenerationPipeline(supabase, { projectId, actorId: user.id });

    if (job) {
      await supabase
        .from('generation_jobs')
        .update({ status: 'completed', progress: 100, completed_at: new Date().toISOString() })
        .eq('id', job.id);
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/editor`);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GENERATION_FAILED';
    console.error('Article generation failed:', error);

    if (job) {
      await supabase
        .from('generation_jobs')
        .update({ status: 'failed', error_message: message, completed_at: new Date().toISOString() })
        .eq('id', job.id);
    }
    await supabase.from('projects').update({ status: 'failed' }).eq('id', projectId);

    return err('GENERATION_FAILED', translateGenerationError(message));
  }
}

function translateGenerationError(message: string): string {
  if (message === 'TRANSCRIPT_NOT_FOUND' || message === 'TRANSCRIPT_EMPTY') {
    return 'Necesitas añadir una transcripción antes de generar el artículo.';
  }
  if (message === 'AI_NOT_CONFIGURED') {
    return 'Falta configurar la API key de IA (AI_API_KEY o GROQ_API_KEY) para generar el artículo.';
  }
  if (message.startsWith('AI_PROVIDER_HTTP_ERROR:413') || message.startsWith('AI_PROVIDER_HTTP_ERROR:429')) {
    return 'El plan gratuito del proveedor de IA alcanzó su límite de tokens por minuto. Espera un minuto y reintenta, usa una transcripción más corta, o sube tu cuenta de Groq a Dev Tier (gratis, más límite).';
  }
  if (message.startsWith('AI_PROVIDER_HTTP_ERROR:404')) {
    return 'El modelo de IA configurado no existe o no está disponible para tu cuenta. Revisa AI_MODEL.';
  }
  if (message.startsWith('AI_PROVIDER_')) {
    return `El proveedor de IA no devolvió una respuesta válida. Inténtalo de nuevo. (${message.slice(0, 200)})`;
  }
  return `No se pudo generar el artículo. Inténtalo de nuevo. (${message.slice(0, 200)})`;
}
