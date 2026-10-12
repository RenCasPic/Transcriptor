import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { GeneratedImageFile } from '@/lib/ai/images/openai-image';

export const ARTICLE_IMAGES_BUCKET = 'article-images';

/** Tipos y tamaño que acepta una imagen subida por el usuario (el bucket aplica los mismos límites). */
export const UPLOAD_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function extensionForMime(mime: string): string | null {
  return EXTENSION_BY_MIME[mime] ?? null;
}

/** Ruta en el bucket: `{workspace_id}/{project_id}/{uuid}.{ext}` (el primer segmento lo usan las políticas RLS). */
export function buildImagePath(workspaceId: string, projectId: string, extension: string): string {
  return `${workspaceId}/${projectId}/${crypto.randomUUID()}.${extension}`;
}

/** Sube una imagen al bucket público y devuelve su URL pública. Lanza si Storage falla. */
export async function uploadArticleImage(
  supabase: SupabaseClient<Database>,
  params: { workspaceId: string; projectId: string; file: GeneratedImageFile },
): Promise<{ url: string; path: string }> {
  const path = buildImagePath(params.workspaceId, params.projectId, params.file.extension);
  const { error } = await supabase.storage.from(ARTICLE_IMAGES_BUCKET).upload(path, params.file.bytes, {
    contentType: params.file.mimeType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(`IMAGE_UPLOAD_FAILED:${error.message}`);

  const { data } = supabase.storage.from(ARTICLE_IMAGES_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/** Borra una imagen del bucket (p. ej. una vista previa descartada). Nunca lanza. */
export async function deleteArticleImage(supabase: SupabaseClient<Database>, path: string): Promise<void> {
  try {
    await supabase.storage.from(ARTICLE_IMAGES_BUCKET).remove([path]);
  } catch {
    /* un archivo huérfano no es grave */
  }
}

/**
 * Ruta dentro del bucket a partir de la URL pública, o `null` si la URL no es de
 * nuestro bucket (p. ej. una portada de Pexels). Solo para operar sobre
 * imágenes propias (descartar una vista previa).
 */
export function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${ARTICLE_IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length).split('?')[0] ?? '') || null;
}
