import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ImageMode } from '@/lib/types/database';
import { getContentGenerationProvider } from '@/lib/ai/providers';
import {
  articleNodesToProseMirrorJson,
  proseMirrorJsonToHtml,
  proseMirrorJsonToMarkdown,
  proseMirrorJsonToPlainText,
} from '@/lib/content/article-transform';
import { countWords, estimateReadingTimeMinutes } from '@/lib/content/metrics';
import { searchCoverImage } from '@/lib/integrations/pexels';
import { isImageGenerationConfigured } from '@/lib/ai/images/config';
import { generateArticleImages, type ArticleImagesResult } from '@/lib/images/generate-article-images';
import { insertImagesIntoContent } from '@/lib/images/insert-images';
import { applyImagesToDocument, createImageDeps, recordImageWarnings } from '@/lib/images/article-images';

// Presupuesto de tiempo de la función (maxDuration = 300 s) para repartir entre
// el texto y las imágenes. Si tras redactar el texto quedan menos de
// DEFER_IMAGES_BELOW_MS, el texto se guarda primero y las imágenes se generan
// después en segundo plano (after()).
const GENERATION_BUDGET_MS = 270_000;
const DEFER_IMAGES_BELOW_MS = 100_000;
const SAVE_MARGIN_MS = 25_000;
const BACKGROUND_IMAGES_BUDGET_MS = 240_000;

export interface RunGenerationParams {
  projectId: string;
  actorId: string | null;
  /** Instante (epoch ms) en que empezó la invocación que contiene esta generación; por defecto, ahora. */
  startedAt?: number;
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
  const startedAt = params.startedAt ?? Date.now();
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
      targetReadingMinutes: project.target_reading_minutes,
    },
  });

  // --- Imágenes con IA (portada + una cada 2-3 secciones) ---
  // Nunca deben hacer fallar la generación del artículo: cualquier problema se
  // registra como alerta y el texto se guarda completo igualmente.
  const imageMode: ImageMode = project.image_mode ?? 'cover_and_inline';
  const imageDeps = isImageGenerationConfigured()
    ? createImageDeps(supabase, { workspaceId: project.workspace_id, projectId: params.projectId })
    : null;
  const imageJobParams =
    imageMode !== 'none' && imageDeps
      ? {
          title: generated.title,
          excerpt: generated.excerpt,
          language: project.language,
          nodes: generated.content,
          mode: imageMode,
          deps: imageDeps,
        }
      : null;

  let images: ArticleImagesResult | null = null;
  let deferImages = false;
  if (imageJobParams) {
    const remainingMs = GENERATION_BUDGET_MS - (Date.now() - startedAt);
    if (remainingMs < DEFER_IMAGES_BELOW_MS) {
      deferImages = true;
    } else {
      images = await generateArticleImages({ ...imageJobParams, deadlineAt: Date.now() + remainingMs - SAVE_MARGIN_MS });
    }
  }

  let contentJson = articleNodesToProseMirrorJson(generated.content, generated.faq);
  const imageFailures = [...(images?.failures ?? [])];
  if (images && images.inline.length > 0) {
    const inserted = insertImagesIntoContent(contentJson, images.inline);
    contentJson = inserted.doc;
    for (const blockId of inserted.missing) {
      imageFailures.push({
        kind: 'inline',
        blockId: null,
        code: 'UNKNOWN',
        message: 'Una imagen generada no se pudo colocar en el artículo (no se encontró su sección).',
      });
      console.error('[images] No se encontró el bloque para insertar una imagen:', blockId);
    }
  }
  const contentHtml = proseMirrorJsonToHtml(contentJson);
  const contentMarkdown = proseMirrorJsonToMarkdown(contentJson);
  const plainText = proseMirrorJsonToPlainText(contentJson);
  const wordCount = countWords(plainText);
  const readingTimeMinutes = estimateReadingTimeMinutes(wordCount);

  // Portada: la generada con IA; si no hay (falló, sin clave...) la de Pexels como antes.
  // Con la opción "Sin imágenes" no se pone ninguna.
  const aiCover = images?.cover ?? null;
  const coverImage =
    aiCover ??
    (imageMode === 'none' || deferImages ? null : await searchCoverImage(generated.seo.primaryKeyword || generated.title));

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
        cover_image_url: coverImage?.url ?? null,
        cover_image_alt: coverImage?.alt ?? null,
        // Solo se escribe cuando las imágenes con IA están activas (así el guardado no depende de la
        // migración 0022 si no se usan). Se limpia al regenerar sin portada generada, para no dejar un
        // prompt de una portada anterior.
        ...(imageJobParams ? { cover_image_prompt: aiCover?.prompt ?? null } : {}),
      },
      { onConflict: 'project_id' },
    )
    .select('id')
    .single();

  if (documentError || !document) {
    throw new Error(`SAVE_DOCUMENT_FAILED:${documentError?.message ?? 'unknown'}`);
  }

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

  await recordImageWarnings(supabase, document.id, imageFailures);

  if (deferImages && imageJobParams) {
    scheduleBackgroundImages(supabase, {
      documentId: document.id,
      actorId: params.actorId,
      pexelsQuery: generated.seo.primaryKeyword || generated.title,
      jobParams: imageJobParams,
    });
  }

  await supabase.from('projects').update({ status: 'review' }).eq('id', params.projectId);

  return { documentId: document.id };
}

type ImageJobParams = Parameters<typeof generateArticleImages>[0];

/**
 * Modo "segundo plano": avisa en el panel de alertas y genera las imágenes con
 * `after()` DESPUÉS de responder. Si `after()` no está disponible, o algo falla,
 * el artículo ya está guardado: solo queda una alerta.
 */
function scheduleBackgroundImages(
  supabase: SupabaseClient<Database>,
  params: { documentId: string; actorId: string | null; pexelsQuery: string; jobParams: ImageJobParams },
): void {
  const run = async () => {
    const images = await generateArticleImages({
      ...params.jobParams,
      deadlineAt: Date.now() + BACKGROUND_IMAGES_BUDGET_MS,
    });
    await applyImagesToDocument(supabase, {
      documentId: params.documentId,
      actorId: params.actorId,
      images,
      pexelsQuery: params.pexelsQuery,
    });
    await recordImageWarnings(supabase, params.documentId, images.failures);
  };

  try {
    after(run);
    void recordImageWarnings(supabase, params.documentId, [
      {
        kind: 'inline',
        blockId: null,
        code: 'UNKNOWN',
        message:
          'Las imágenes se están generando en segundo plano y se insertarán en el artículo en unos minutos. Recarga el editor para verlas.',
      },
    ]);
  } catch (error) {
    console.error('[images] No se pudo programar la generación de imágenes en segundo plano:', error);
    void recordImageWarnings(supabase, params.documentId, [
      {
        kind: 'inline',
        blockId: null,
        code: 'UNKNOWN',
        message: 'No se generaron las imágenes del artículo (se acabó el tiempo). Puedes añadirlas desde el editor.',
      },
    ]);
  }
}
