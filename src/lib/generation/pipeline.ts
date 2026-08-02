import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { getContentGenerationProvider } from '@/lib/ai/providers';
import {
  articleNodesToProseMirrorJson,
  proseMirrorJsonToHtml,
  proseMirrorJsonToMarkdown,
  proseMirrorJsonToPlainText,
} from '@/lib/content/article-transform';
import { countWords, estimateReadingTimeMinutes } from '@/lib/content/metrics';

export interface RunGenerationParams {
  projectId: string;
  actorId: string | null;
}

/**
 * Lógica de negocio del flujo de generación (sección 10 del brief), aislada de
 * cualquier mecanismo de transporte. Hoy se invoca desde una Server Action
 * (`generateArticleAction`), pero puede moverse a un worker en segundo plano
 * sin cambios: solo requiere un cliente de Supabase (de request o admin).
 */
export async function runArticleGenerationPipeline(
  supabase: SupabaseClient<Database>,
  params: RunGenerationParams,
): Promise<{ documentId: string }> {
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.projectId)
    .single();
  if (!project) throw new Error('PROJECT_NOT_FOUND');

  const { data: transcript } = await supabase
    .from('transcripts')
    .select('id, language, full_text')
    .eq('project_id', params.projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!transcript) throw new Error('TRANSCRIPT_NOT_FOUND');

  const { data: segments } = await supabase
    .from('transcript_segments')
    .select('id, segment_index, speaker, start_seconds, end_seconds, text')
    .eq('transcript_id', transcript.id)
    .order('segment_index', { ascending: true });
  if (!segments || segments.length === 0) throw new Error('TRANSCRIPT_EMPTY');

  const provider = getContentGenerationProvider();

  const generated = await provider.generateArticle({
    transcript: {
      fullText: transcript.full_text,
      language: transcript.language,
      segments: segments.map((s) => ({
        id: s.id,
        index: s.segment_index,
        speaker: s.speaker,
        startSeconds: s.start_seconds,
        endSeconds: s.end_seconds,
        text: s.text,
      })),
    },
    project: {
      contentType: project.content_type,
      audience: project.audience,
      tone: project.tone,
      language: project.language,
      primaryKeyword: project.primary_keyword,
      objective: project.objective,
      callToAction: project.call_to_action,
      provisionalTitle: project.provisional_title,
    },
  });

  const contentJson = articleNodesToProseMirrorJson(generated.content, generated.faq);
  const contentHtml = proseMirrorJsonToHtml(contentJson);
  const contentMarkdown = proseMirrorJsonToMarkdown(contentJson);
  const plainText = proseMirrorJsonToPlainText(contentJson);
  const wordCount = countWords(plainText);
  const readingTimeMinutes = estimateReadingTimeMinutes(wordCount);

  const { data: document, error: documentError } = await supabase
    .from('content_documents')
    .upsert(
      {
        project_id: params.projectId,
        title: generated.title,
        excerpt: generated.excerpt,
        content_json: contentJson,
        content_html: contentHtml,
        content_markdown: contentMarkdown,
        status: 'draft',
        word_count: wordCount,
        reading_time_minutes: readingTimeMinutes,
        version: 1,
      },
      { onConflict: 'project_id' },
    )
    .select('id')
    .single();

  if (documentError || !document) throw new Error('SAVE_DOCUMENT_FAILED');

  await supabase.from('document_versions').insert({
    document_id: document.id,
    created_by: params.actorId,
    version_number: 1,
    title: generated.title,
    content_json: contentJson,
    content_html: contentHtml,
    reason: 'initial_generation',
  });

  await supabase.from('seo_metadata').upsert(
    {
      document_id: document.id,
      seo_title: generated.seo.title,
      slug: generated.seo.slug,
      meta_description: generated.seo.metaDescription,
      primary_keyword: generated.seo.primaryKeyword ?? null,
      secondary_keywords: generated.seo.secondaryKeywords,
    },
    { onConflict: 'document_id' },
  );

  if (generated.warnings.length > 0) {
    await supabase.from('content_warnings').insert(
      generated.warnings.map((w) => ({
        document_id: document.id,
        block_id: w.blockId,
        warning_type: w.type,
        message: w.message,
      })),
    );
  }

  const segmentIdSet = new Set(segments.map((s) => s.id));
  const sourceLinks: Array<{ document_id: string; block_id: string; transcript_segment_id: string }> = [];
  generated.content.forEach((node) => {
    node.sourceSegmentIds.forEach((segmentId) => {
      if (segmentIdSet.has(segmentId)) {
        sourceLinks.push({ document_id: document.id, block_id: node.id, transcript_segment_id: segmentId });
      }
    });
  });
  if (sourceLinks.length > 0) {
    await supabase.from('content_source_links').insert(sourceLinks);
  }

  await supabase.from('projects').update({ status: 'review' }).eq('id', params.projectId);

  return { documentId: document.id };
}
