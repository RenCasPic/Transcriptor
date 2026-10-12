'use client';

import { createClient } from '@/lib/supabase/client';
import {
  ARTICLE_IMAGES_BUCKET,
  UPLOAD_ALLOWED_MIME_TYPES,
  UPLOAD_MAX_BYTES,
  buildImagePath,
  extensionForMime,
} from './storage';

export type UploadErrorCode = 'TYPE' | 'SIZE' | 'UPLOAD';

export class ImageUploadError extends Error {
  readonly code: UploadErrorCode;

  constructor(code: UploadErrorCode) {
    super(code);
    this.name = 'ImageUploadError';
    this.code = code;
  }
}

/** Valida tipo (JPG/PNG/WebP) y tamaño (máx. 10 MB) antes de subir. */
export function validateImageFile(file: File): UploadErrorCode | null {
  if (!(UPLOAD_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) return 'TYPE';
  if (file.size > UPLOAD_MAX_BYTES) return 'SIZE';
  return null;
}

/**
 * Sube una imagen del usuario (p. ej. hecha en Canva) DIRECTO al bucket público
 * desde el navegador, con su sesión: así no pasa por el límite de 4 MB de las
 * Server Actions y la política RLS del bucket decide quién puede escribir
 * (solo editores del workspace, y solo en la carpeta de su workspace).
 */
export async function uploadImageFile(
  file: File,
  ctx: { workspaceId: string; projectId: string },
): Promise<{ url: string }> {
  const invalid = validateImageFile(file);
  if (invalid) throw new ImageUploadError(invalid);

  const extension = extensionForMime(file.type);
  if (!extension) throw new ImageUploadError('TYPE');

  const supabase = createClient();
  const path = buildImagePath(ctx.workspaceId, ctx.projectId, extension);
  const { error } = await supabase.storage.from(ARTICLE_IMAGES_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new ImageUploadError('UPLOAD');

  const { data } = supabase.storage.from(ARTICLE_IMAGES_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
