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
