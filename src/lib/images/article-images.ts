import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/types/database';
import { getContentGenerationProvider } from '@/lib/ai/providers';
import { generateImage } from '@/lib/ai/images/openai-image';
import { proseMirrorJsonToHtml, proseMirrorJsonToMarkdown } from '@/lib/content/article-transform';
import { searchCoverImage } from '@/lib/integrations/pexels';
import type { ArticleImagesResult, ImageDeps, ImageFailure } from './generate-article-images';
import { insertImagesIntoContent } from './insert-images';
import { uploadArticleImage } from './storage';

/** Dependencias reales (OpenAI + Supabase Storage) para `generateArticleImages`. */
export function createImageDeps(
  supabase: SupabaseClient<Database>,
  ctx: { workspaceId: string; projectId: string },
): ImageDeps {
  return {
    plan: (input) => getContentGenerationProvider().planArticleImages(input),
    generate: (prompt, options) => generateImage(prompt, { timeoutMs: options.timeoutMs }),
    upload: (file) => uploadArticleImage(supabase, { ...ctx, file }),
  };
}

/**
 * Guarda las fallas de imagen como alertas del editor (`content_warnings`,
 * tipo `image_generation`). Nunca lanza: si la tabla aún no admite el tipo (la
 * migración 0022 sin aplicar), simplemente se omite.
 */
export async function recordImageWarnings(
  supabase: SupabaseClient<Database>,
  documentId: string,
  failures: ImageFailure[],
): Promise<void> {
  if (failures.length === 0) return;
  try {
    const { error } = await supabase.from('content_warnings').insert(
      failures.map((f) => ({
        document_id: documentId,
        block_id: f.blockId,
        warning_type: 'image_generation' as const,
        message: f.message,
      })),
    );
    if (error) console.error('[images] No se pudieron guardar las alertas de imagen:', error.message);
  } catch (error) {
    console.error('[images] No se pudieron guardar las alertas de imagen:', error);
  }
}

const MAX_APPLY_ATTEMPTS = 4;

/**
 * Modo "segundo plano": cuando casi no queda tiempo en la función, el texto se
 * guarda primero y las imágenes se generan después (con `after()`). Al terminar
 * se insertan sobre el documento ACTUAL (por si el usuario ya empezó a editar)
 * con control de versión optimista, y quedan en el historial de versiones.
 * Nunca lanza.
 */
export async function applyImagesToDocument(
  supabase: SupabaseClient<Database>,
  params: { documentId: string; actorId: string | null; images: ArticleImagesResult; pexelsQuery: string },
): Promise<void> {
  const { documentId, images } = params;

  try {
    for (let attempt = 0; attempt < MAX_APPLY_ATTEMPTS; attempt++) {
      const { data: doc } = await supabase
        .from('content_documents')
        .select('id, title, version, content_json, cover_image_url')
        .eq('id', documentId)
        .maybeSingle();
      if (!doc) return;

      const inserted = insertImagesIntoContent(doc.content_json as Json, images.inline);
      const needsCover = !doc.cover_image_url;
      const pexels = needsCover && !images.cover ? await searchCoverImage(params.pexelsQuery) : null;
      if (inserted.inserted === 0 && !(needsCover && (images.cover || pexels))) return;

      const contentJson = inserted.doc;
      const contentHtml = proseMirrorJsonToHtml(contentJson);
      const nextVersion = doc.version + 1;

      const { data: updated, error } = await supabase
        .from('content_documents')
        .update({
          content_json: contentJson,
          content_html: contentHtml,
          content_markdown: proseMirrorJsonToMarkdown(contentJson),
          version: nextVersion,
          ...(needsCover && images.cover
            ? {
                cover_image_url: images.cover.url,
                cover_image_alt: images.cover.alt,
                cover_image_prompt: images.cover.prompt,
              }
            : needsCover && pexels
              ? { cover_image_url: pexels.url, cover_image_alt: pexels.alt }
              : {}),
        })
        .eq('id', documentId)
        .eq('version', doc.version)
        .select('id');

      if (error) {
        console.error('[images] No se pudieron insertar las imágenes en el documento:', error.message);
        return;
      }
      if (!updated || updated.length === 0) continue; // el usuario guardó entre medias: se reintenta

      const { data: last } = await supabase
        .from('document_versions')
        .select('version_number')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      await supabase.from('document_versions').insert({
        document_id: documentId,
        created_by: params.actorId,
        version_number: (last?.version_number ?? 0) + 1,
        title: doc.title,
        content_json: contentJson,
        content_html: contentHtml,
        reason: 'images_generated',
      });
      return;
    }
    console.error('[images] El documento cambió demasiado: no se insertaron las imágenes en segundo plano.');
  } catch (error) {
    console.error('[images] Error al aplicar las imágenes en segundo plano:', error);
  }
}
