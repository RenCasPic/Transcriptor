/** Elimina marcas diacríticas combinantes (U+0300–U+036F) tras una normalización NFD. */
function stripCombiningDiacritics(input: string): string {
  return Array.from(input)
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      return codePoint < 0x0300 || codePoint > 0x036f;
    })
    .join('');
}

export function slugify(input: string): string {
  return stripCombiningDiacritics(input.normalize('NFD'))
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/g, '');
}

/**
 * Convierte un nombre de archivo arbitrario (con tildes, espacios, mayúsculas,
 * etc.) en uno seguro para usar como clave de Supabase Storage, que rechaza
 * ("Invalid key") nombres con ciertos caracteres no ASCII. Conserva la
 * extensión; el nombre original se guarda aparte (`original_filename`) para
 * mostrarlo en la interfaz.
 */
export function sanitizeFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  const hasExtension = lastDot > 0 && lastDot < filename.length - 1;
  const base = hasExtension ? filename.slice(0, lastDot) : filename;
  const extension = hasExtension ? slugify(filename.slice(lastDot + 1)) : '';

  const safeBase = slugify(base) || 'archivo';
  return extension ? `${safeBase}.${extension}` : safeBase;
}
