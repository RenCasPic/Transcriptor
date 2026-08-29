'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ImportTranscriptSchema,
  ArticleConfigSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ImportTranscriptInput,
} from '@/lib/validations/project';
import { normalizeTranscript } from '@/lib/content/normalize';
import type { Database } from '@/lib/types/database';
import { getCurrentWorkspace } from '@/lib/data/workspace';

const MAX_TRANSCRIPT_LENGTH = 200_000;

export async function createProjectAction(input: CreateProjectInput): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return err('UNAUTHENTICATED', 'Debes iniciar sesión.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err('UNAUTHENTICATED', 'Debes iniciar sesión.');
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspace.id,
      created_by: user.id,
      name: parsed.data.name,
      provisional_title: parsed.data.provisionalTitle || null,
      content_type: parsed.data.contentType,
      audience: parsed.data.audience || null,
      tone: parsed.data.tone,
      language: parsed.data.language,
      primary_keyword: parsed.data.primaryKeyword || null,
      objective: parsed.data.objective || null,
      call_to_action: parsed.data.callToAction || null,
      target_reading_minutes: parsed.data.targetReadingMinutes ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    return err('CREATE_PROJECT_ERROR', 'No se pudo crear el proyecto.');
  }

  revalidatePath('/dashboard');
  return ok({ id: data.id });
}

const QUICK_PROJECT_DEFAULTS = {
  upload: { namePrefix: 'Video subido' },
  youtube: { namePrefix: 'Video de YouTube' },
} as const;

const QuickCreateProjectSchema = ArticleConfigSchema.extend({
  source: z.enum(['upload', 'youtube']),
});

export type QuickCreateProjectInput = z.infer<typeof QuickCreateProjectSchema>;

/**
 * Crea un proyecto con configuración por defecto (editable después desde
 * `EditProjectDialog`) para los accesos directos del Dashboard ("Subir
 * video" / "Conectar YouTube"), que van directo a importar la fuente sin
 * pasar por el formulario de `/projects/new`.
 */
export async function createQuickProjectAction(
  input: QuickCreateProjectInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = QuickCreateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return err('UNAUTHENTICATED', 'Debes iniciar sesión.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err('UNAUTHENTICATED', 'Debes iniciar sesión.');
  }

  const { namePrefix } = QUICK_PROJECT_DEFAULTS[parsed.data.source];
  const name = `${namePrefix} — ${new Date().toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}`;

  const { data, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspace.id,
      created_by: user.id,
      name,
      content_type: parsed.data.contentType,
      tone: parsed.data.tone,
      language: 'es',
      audience: parsed.data.audience || null,
      primary_keyword: parsed.data.primaryKeyword || null,
      objective: parsed.data.objective || null,
      call_to_action: parsed.data.callToAction || null,
      target_reading_minutes: parsed.data.targetReadingMinutes ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    return err('CREATE_PROJECT_ERROR', 'No se pudo crear el proyecto.');
  }

  revalidatePath('/dashboard');
  return ok({ id: data.id });
}

export async function updateProjectAction(
  projectId: string,
  input: UpdateProjectInput,
): Promise<ActionResult<null>> {
  const parsed = UpdateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const supabase = await createClient();
  const update: Database['public']['Tables']['projects']['Update'] = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.provisionalTitle !== undefined) update.provisional_title = parsed.data.provisionalTitle || null;
  if (parsed.data.contentType !== undefined) update.content_type = parsed.data.contentType;
  if (parsed.data.audience !== undefined) update.audience = parsed.data.audience || null;
  if (parsed.data.tone !== undefined) update.tone = parsed.data.tone;
  if (parsed.data.language !== undefined) update.language = parsed.data.language;
  if (parsed.data.primaryKeyword !== undefined) update.primary_keyword = parsed.data.primaryKeyword || null;
  if (parsed.data.objective !== undefined) update.objective = parsed.data.objective || null;
  if (parsed.data.callToAction !== undefined) update.call_to_action = parsed.data.callToAction || null;
  if (parsed.data.targetReadingMinutes !== undefined) {
    update.target_reading_minutes = parsed.data.targetReadingMinutes ?? null;
  }
  if (parsed.data.status !== undefined) update.status = parsed.data.status;

  const { error } = await supabase.from('projects').update(update).eq('id', projectId);

  if (error) {
    return err('UPDATE_PROJECT_ERROR', 'No se pudo actualizar el proyecto.');
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/dashboard');
  return ok(null);
}

export async function deleteProjectAction(projectId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from('projects').delete().eq('id', projectId);

  if (error) {
    return err('DELETE_PROJECT_ERROR', 'No se pudo eliminar el proyecto.');
  }

  revalidatePath('/dashboard');
  return ok(null);
}

export async function importTranscriptAction(
  input: ImportTranscriptInput,
): Promise<ActionResult<{ transcriptId: string }>> {
  const parsed = ImportTranscriptSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  if (parsed.data.text.length > MAX_TRANSCRIPT_LENGTH) {
    return err('TRANSCRIPT_TOO_LARGE', 'La transcripción supera el tamaño máximo permitido (200,000 caracteres).');
  }

  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, workspace_id')
    .eq('id', parsed.data.projectId)
    .maybeSingle();

  if (!project) {
    return err('NOT_FOUND', 'Proyecto no encontrado.');
  }

  const normalized = normalizeTranscript(parsed.data.text, parsed.data.sourceType);

  if (normalized.segments.length === 0) {
    return err('EMPTY_TRANSCRIPT', 'No se pudo extraer contenido de la transcripción.');
  }

  const { data: source, error: sourceError } = await supabase
    .from('media_sources')
    .insert({
      project_id: parsed.data.projectId,
      source_type: parsed.data.sourceType,
      original_filename: parsed.data.originalFilename ?? null,
      storage_path: parsed.data.storagePath ?? null,
    })
    .select('id')
    .single();

  if (sourceError || !source) {
    return err('CREATE_SOURCE_ERROR', 'No se pudo registrar la fuente.');
  }

  const { data: transcript, error: transcriptError } = await supabase
    .from('transcripts')
    .insert({
      project_id: parsed.data.projectId,
      source_id: source.id,
      language: parsed.data.language,
      full_text: normalized.fullText,
      status: 'ready',
    })
    .select('id')
    .single();

  if (transcriptError || !transcript) {
    return err('CREATE_TRANSCRIPT_ERROR', 'No se pudo guardar la transcripción.');
  }

  const { error: segmentsError } = await supabase.from('transcript_segments').insert(
    normalized.segments.map((segment) => ({
      transcript_id: transcript.id,
      segment_index: segment.index,
      speaker: segment.speaker,
      start_seconds: segment.startSeconds,
      end_seconds: segment.endSeconds,
      text: segment.text,
    })),
  );

  if (segmentsError) {
    return err('CREATE_SEGMENTS_ERROR', 'No se pudieron guardar los segmentos de la transcripción.');
  }

  revalidatePath(`/projects/${parsed.data.projectId}`);
  return ok({ transcriptId: transcript.id });
}

export async function createProjectAndRedirect(input: CreateProjectInput) {
  const result = await createProjectAction(input);
  if (result.success) {
    redirect(`/projects/${result.data.id}`);
  }
  return result;
}
