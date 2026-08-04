import { createClient } from '@/lib/supabase/server';

export interface PublicDocument {
  id: string;
  title: string;
  excerpt: string | null;
  contentHtml: string;
  wordCount: number;
  readingTimeMinutes: number;
  updatedAt: string;
  seoTitle: string | null;
  metaDescription: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
}

/**
 * Lee un artículo público por id de documento (sin autenticación: se apoya
 * en las políticas RLS `content_documents_select_public` /
 * `seo_metadata_select_public`, que solo exponen documentos con
 * `is_public = true`). Usado por la página de inserción (`/embed/[id]`).
 */
export async function getPublicDocument(documentId: string): Promise<PublicDocument | null> {
  const supabase = await createClient();

  const { data: document } = await supabase
    .from('content_documents')
    .select(
      'id, title, excerpt, content_html, word_count, reading_time_minutes, updated_at, is_public, cover_image_url, cover_image_alt',
    )
    .eq('id', documentId)
    .eq('is_public', true)
    .maybeSingle();

  if (!document) return null;

  const { data: seo } = await supabase
    .from('seo_metadata')
    .select('seo_title, meta_description')
    .eq('document_id', documentId)
    .maybeSingle();

  return {
    id: document.id,
    title: document.title,
    excerpt: document.excerpt,
    contentHtml: document.content_html,
    wordCount: document.word_count,
    readingTimeMinutes: document.reading_time_minutes,
    updatedAt: document.updated_at,
    seoTitle: seo?.seo_title ?? null,
    metaDescription: seo?.meta_description ?? null,
    coverImageUrl: document.cover_image_url,
    coverImageAlt: document.cover_image_alt,
  };
}
