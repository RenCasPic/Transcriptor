import type { ArticleSection } from '@/lib/images/plan';

export interface ImagePlanPromptInput {
  title: string;
  excerpt: string;
  language: string;
  sections: ArticleSection[];
  inlineCount: number;
  includeCover: boolean;
}

const VISUAL_RULES = `Reglas para CADA descripción de imagen ("prompt"):
- Escríbela en el IDIOMA DEL ARTÍCULO (NO en inglés, salvo que el artículo esté en inglés), en 1-3 frases concretas: sujeto, escena, ambiente, composición. Describe algo que se pueda FOTOGRAFIAR.
- Estilo fotográfico editorial. TODAS las imágenes del artículo deben compartir la misma paleta de color, iluminación y ambiente (define uno en "style").
- SIN texto, letras, números, logos, marcas ni capturas de pantalla dentro de la imagen.
- Basa la descripción SOLO en lo que el texto de esa sección dice realmente. No inventes personas concretas, marcas, cifras ni nada que contradiga el artículo.
- No uses nombres de personas reales ni figuras públicas.
- "alt": texto alternativo descriptivo (una frase, máx. 125 caracteres) en el idioma del artículo, que describa lo que se ve y conecte con el tema.`;

/** Prompt que pide a la IA de texto el plan completo de imágenes (portada + secciones) de un artículo. */
export function buildImagePlanPrompt(input: ImagePlanPromptInput): string {
  const sectionList = input.sections
    .map((s) => `[${s.index}] ${s.heading}\n    ${s.text || '(sin texto)'}`)
    .join('\n');

  const coverPart = input.includeCover
    ? '- "cover": imagen de portada, basada en el título y el extracto del artículo.'
    : '- "cover": null (no se pide portada).';

  const inlinePart =
    input.inlineCount > 0
      ? `- "images": EXACTAMENTE ${input.inlineCount} imágenes para secciones distintas. Elige las secciones más visuales o importantes (con "sectionIndex" = el número entre corchetes) y, si es posible, repartidas a lo largo del artículo.`
      : '- "images": [] (no se piden imágenes dentro del artículo).';

  return `Eres el director de arte de un blog. Define las imágenes de un artículo.

Idioma del artículo: ${input.language}
Título: ${input.title}
Extracto: ${input.excerpt}

Secciones (H2) del artículo, con un resumen de su texto:
${sectionList || '(sin secciones)'}

Devuelve:
- "style": una frase corta, en el idioma del artículo, con el estilo visual común (paleta, luz, ambiente) para todas las imágenes.
${coverPart}
${inlinePart}

${VISUAL_RULES}

Devuelve un JSON con exactamente esta forma:
{ "style": string, "cover": { "prompt": string, "alt": string } | null, "images": [{ "sectionIndex": number, "prompt": string, "alt": string }] }`;
}

/** Prompt para sugerir la descripción de UNA imagen a partir de un párrafo (botón "insertar imagen" del editor). */
export function buildImageSuggestionPrompt(input: { title: string; text: string; language: string }): string {
  return `Eres el director de arte de un blog. Propón una imagen para ilustrar este fragmento de un artículo.

Idioma del artículo: ${input.language}
Título del artículo: ${input.title}
Fragmento: ${input.text.slice(0, 1200)}

${VISUAL_RULES}

Devuelve un JSON con exactamente esta forma: { "prompt": string, "alt": string }`;
}
