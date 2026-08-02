import { COMMON_RULES } from './rules';
import type { SeoInput } from '@/lib/ai/provider';

/** Prompt para generar/actualizar metadata SEO a partir del contenido final del artículo. */
export function buildSeoPrompt(input: SeoInput): string {
  return `Eres un especialista en SEO on-page. A partir del siguiente artículo, genera metadata SEO.

Idioma: ${input.language}
Palabra clave principal (si el usuario la definió, respétala): ${input.primaryKeyword ?? 'ninguna, sugiere una'}

${COMMON_RULES}

No prometas posicionamiento ni presentes el resultado como garantía de ranking.

Genera:
- title: título SEO de máximo 60 caracteres.
- slug: slug en minúsculas, separado por guiones, sin acentos ni caracteres especiales.
- metaDescription: meta description de máximo 155 caracteres, orientada a generar clics sin clickbait.
- primaryKeyword: palabra clave principal utilizada.
- secondaryKeywords: 3 a 6 palabras clave secundarias relacionadas.

Título actual: ${input.title}
Extracto: ${input.excerpt}
Contenido (texto plano, referencia): ${input.contentPlainText.slice(0, 4000)}`;
}
