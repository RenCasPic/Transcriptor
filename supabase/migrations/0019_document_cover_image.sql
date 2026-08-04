-- Imagen de portada del artículo (buscada automáticamente por tema/palabra
-- clave en un banco de imágenes gratuito, ver src/lib/integrations/pexels.ts).
-- Es un campo independiente del contenido (no un bloque de ProseMirror), para
-- no tener que tocar el esquema del editor: se muestra como banner encima
-- del título tanto en el editor como en la página pública de inserción.
alter table public.content_documents
  add column cover_image_url text,
  add column cover_image_alt text;
