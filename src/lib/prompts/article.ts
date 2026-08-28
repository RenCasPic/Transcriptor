import { COMMON_RULES, toneInstruction } from './rules';
import type { GenerateArticleInput } from '@/lib/ai/provider';

const CONTENT_TYPE_GUIDANCE: Record<string, string> = {
  tutorial: 'Estructura el contenido como pasos secuenciales, numerados cuando sea posible.',
  guide: 'Organiza el contenido en secciones temáticas que guíen al lector de lo general a lo específico.',
  list: 'Organiza el contenido como una lista de elementos claramente diferenciados con su propio encabezado.',
  interview: 'Conserva la voz y las afirmaciones de cada persona entrevistada, atribuyéndolas correctamente.',
  summary: 'Prioriza la síntesis de los puntos más importantes sin perder matices relevantes.',
  case_study: 'Estructura el contenido como contexto, problema, solución aplicada y resultados obtenidos.',
  opinion: 'Deja clara la perspectiva expuesta en la transcripción sin presentarla como consenso general.',
  qa: 'Estructura el contenido como preguntas y respuestas claramente diferenciadas.',
};

/** Prompt principal para redactar el artículo completo a partir de la transcripción. */
export function buildArticlePrompt(input: GenerateArticleInput): string {
  const { project, transcript } = input;

  return `Eres un redactor experto en transformar transcripciones en artículos de blog bien estructurados,
sin resumir superficialmente: reorganiza la información en un artículo coherente y útil.

Tipo de contenido: ${project.contentType}. ${CONTENT_TYPE_GUIDANCE[project.contentType] ?? ''}
Audiencia: ${project.audience ?? 'general'}
${toneInstruction(project.tone)}
Objetivo del artículo: ${project.objective ?? 'informar de manera clara y útil'}
Llamada a la acción a incluir al final (si aplica): ${project.callToAction ?? 'ninguna en particular'}
Palabra clave principal (si aplica, intégrala de forma natural): ${project.primaryKeyword ?? 'ninguna'}
Título provisional sugerido por el usuario (puedes mejorarlo): ${project.provisionalTitle ?? 'ninguno'}
Idioma: ${project.language}

${COMMON_RULES}

Genera:
- title: título principal del artículo.
- excerpt: extracto de 1-2 frases que resuma el artículo.
- content: lista de bloques (heading nivel 2/3, paragraph, list, quote), cada uno con un id único
  y sourceSegmentIds: la lista de las etiquetas de segmento (p. ej. "s0", "s12") de la transcripción
  que respaldan ese bloque. Copia la etiqueta EXACTA que aparece entre corchetes al inicio de cada
  línea de la transcripción; no inventes etiquetas.
- faq: 2-5 preguntas frecuentes derivadas del contenido, cada una con sourceSegmentIds (mismo criterio).
- seo: título SEO, slug, meta description, palabra clave principal y palabras clave secundarias.
- warnings: cualquier afirmación (cifra, nombre, fecha) que no esté completamente respaldada por la fuente,
  indicando el id del bloque afectado y un mensaje explicando la incertidumbre.

Transcripción (cada línea empieza con su etiqueta de segmento entre corchetes; úsala tal cual en sourceSegmentIds):
${transcript.segments.map((s) => `[s${s.index}] ${s.speaker ? `${s.speaker}: ` : ''}${s.text}`).join('\n')}`;
}
