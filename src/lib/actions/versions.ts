'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';
import { proseMirrorJsonToHtml, proseMirrorJsonToPlainText } from '@/lib/content/article-transform';
import { countWords, estimateReadingTimeMinutes } from '@/lib/content/metrics';
import type { Json } from '@/lib/types/database';

const CreateVersionSchema = z.object({
  documentId: z.string().uuid(),
  reason: z.string().min(1).max(200),
});

/** Crea una versión manual a partir del estado actual del documento (snapshot explícito del usuario). */
export async function createVersionAction(
  input: z.infer<typeof CreateVersionSchema>,
): Promise<ActionResult<{ versionNumber: number }>> {
  const parsed = CreateVersionSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Datos inválidos.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: document } = await supabase
    .from('content_documents')
    .select('id, title, content_json, content_html')
    .eq('id', parsed.data.documentId)
    .maybeSingle();
  if (!document) return err('NOT_FOUND', 'Documento no encontrado.');

  const { data: lastVersion } = await supabase
    .from('document_versions')
    .select('version_number')
    .eq('document_id', document.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const versionNumber = (lastVersion?.version_number ?? 0) + 1;

  const { error } = await supabase.from('document_versions').insert({
    document_id: document.id,
    created_by: user?.id ?? null,
    version_number: versionNumber,
    title: document.title,
    content_json: document.content_json,
    content_html: document.content_html,
    reason: parsed.data.reason,
  });

  if (error) return err('SAVE_ERROR', 'No se pudo crear la versión.');
  return ok({ versionNumber });
}

const RestoreVersionSchema = z.object({
  documentId: z.string().uuid(),
  versionId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export async function restoreVersionAction(
  input: z.infer<typeof RestoreVersionSchema>,
): Promise<ActionResult<null>> {
  const parsed = RestoreVersionSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR', 'Datos inválidos.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: version } = await supabase
    .from('document_versions')
    .select('*')
    .eq('id', parsed.data.versionId)
    .maybeSingle();
  if (!version) return err('NOT_FOUND', 'Versión no encontrada.');

  const { data: current } = await supabase
    .from('content_documents')
    .select('version')
    .eq('id', parsed.data.documentId)
    .maybeSingle();
  if (!current) return err('NOT_FOUND', 'Documento no encontrado.');

  const contentJson = version.content_json as Json;
  const plainText = proseMirrorJsonToPlainText(contentJson);
  const wordCount = countWords(plainText);
  const readingTimeMinutes = estimateReadingTimeMinutes(wordCount);
  const html = version.content_html || proseMirrorJsonToHtml(contentJson);
  const nextVersion = current.version + 1;

  const { error: updateError } = await supabase
    .from('content_documents')
    .update({
      title: version.title,
      content_json: contentJson,
      content_html: html,
      word_count: wordCount,
      reading_time_minutes: readingTimeMinutes,
      version: nextVersion,
    })
    .eq('id', parsed.data.documentId);

  if (updateError) return err('SAVE_ERROR', 'No se pudo restaurar la versión.');

  const { data: lastVersion } = await supabase
    .from('document_versions')
    .select('version_number')
    .eq('document_id', parsed.data.documentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from('document_versions').insert({
    document_id: parsed.data.documentId,
    created_by: user?.id ?? null,
    version_number: (lastVersion?.version_number ?? 0) + 1,
    title: version.title,
    content_json: contentJson,
    content_html: html,
    reason: `restored_from_version_${version.version_number}`,
  });

  revalidatePath(`/projects/${parsed.data.projectId}/editor`);
  return ok(null);
}
