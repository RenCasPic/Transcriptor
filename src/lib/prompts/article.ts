import { COMMON_RULES, toneInstruction } from './rules';
import type { GenerateArticleInput } from '@/lib/ai/provider';
import type { ExtractedNote, ArticleOutline } from '@/lib/validations/article';

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

  return `Eres un redactor editorial. Conviertes esta transcripción en un ARTÍCULO COMPLETO y bien escrito
que aprovecha a fondo el contenido de la conversación. NO es un resumen.

El artículo debe recoger TODAS las ideas, argumentos, explicaciones, ejemplos concretos, cifras, nombres
y contexto que aparecen en la transcripción, reorganizados en una estructura editorial clara y
desarrollados con prosa fluida. Si la conversación dedica varios minutos a un punto con ejemplos y
razones, la sección correspondiente del artículo debe reflejar esa misma profundidad.

Cómo trabajar:
1. Recorre la transcripción de principio a fin e identifica cada tema y subtema que se trata.
2. Para cada tema, redacta una o varias secciones con párrafos completos (no frases sueltas) que
   desarrollen la idea con el mismo detalle que tiene en la fuente: incluye los ejemplos que se
   mencionan, los datos, las razones que se dan, las objeciones, los matices y las conclusiones.
3. Cubre TODA la transcripción. No te quedes solo con los primeros minutos ni con las ideas más
   evidentes: el contenido del final es tan importante como el del principio.
4. La extensión la determina la riqueza de la conversación, no un número fijo. Un artículo corto para
   una transcripción con mucho contenido útil es un ERROR: significa que se perdió información.

Lo ÚNICO que se elimina: saludos y despedidas, muletillas y titubeos, digresiones sin relación con el
tema, y repeticiones literales. NO elimines una idea, un ejemplo o un dato solo porque el artículo
quedaría más corto.

Tipo de contenido: ${project.contentType}. ${CONTENT_TYPE_GUIDANCE[project.contentType] ?? ''}
Audiencia: ${project.audience ?? 'general'}
${toneInstruction(project.tone)}
Objetivo del artículo: ${project.objective ?? 'informar de manera clara y útil, aprovechando todo el contenido de la conversación'}
Llamada a la acción a incluir al final (si aplica): ${project.callToAction ?? 'ninguna en particular'}
Palabra clave principal (si aplica, intégrala de forma natural): ${project.primaryKeyword ?? 'ninguna'}
Título provisional sugerido por el usuario (puedes mejorarlo): ${project.provisionalTitle ?? 'ninguno'}
Idioma: ${project.language}

${COMMON_RULES}

Genera:
- title: título principal del artículo.
- excerpt: extracto de 1-2 frases que resuma de qué trata el artículo.
- content: los bloques del artículo (heading nivel 2/3, paragraph, list, quote), cada uno con un id
  único. Cada paragraph debe ser un párrafo real de varias frases con contenido sustantivo de la
  transcripción; usa heading para separar temas, list solo cuando la fuente enumera elementos, y
  quote para reproducir una frase textual relevante del orador. Cada bloque lleva sourceSegmentIds:
  la lista de etiquetas de segmento (p. ej. "s0", "s12") que respaldan ese bloque; copia la etiqueta
  EXACTA que aparece entre corchetes al inicio de cada línea de la transcripción, no inventes etiquetas.
- faq: 3-6 preguntas frecuentes derivadas del contenido, respondidas con la información de la
  transcripción, cada una con sourceSegmentIds (mismo criterio).
- seo: título SEO, slug, meta description, palabra clave principal y palabras clave secundarias.
- warnings: cualquier afirmación (cifra, nombre, fecha) que no esté completamente respaldada por la
  fuente, indicando el id del bloque afectado y un mensaje explicando la incertidumbre.

Transcripción (cada línea empieza con su etiqueta de segmento entre corchetes; úsala tal cual en sourceSegmentIds):
${transcript.segments.map((s) => `[s${s.index}] ${s.speaker ? `${s.speaker}: ` : ''}${s.text}`).join('\n')}`;
}

function projectContext(project: GenerateArticleInput['project']): string {
  return `Tipo de contenido: ${project.contentType}. ${CONTENT_TYPE_GUIDANCE[project.contentType] ?? ''}
Audiencia: ${project.audience ?? 'general'}
${toneInstruction(project.tone)}
Objetivo del artículo: ${project.objective ?? 'informar de manera clara y útil, aprovechando todo el contenido de la conversación'}
Idioma: ${project.language}`;
}

function numberedNotes(notes: ExtractedNote[]): string {
  return notes.map((n, i) => `${i + 1}. ${n.point}`).join('\n');
}

/** Etapa 2: agrupar las notas en secciones temáticas ordenadas (esqueleto del artículo). */
export function buildOutlinePrompt(input: GenerateArticleInput, notes: ExtractedNote[]): string {
  const { project } = input;
  const suggested = Math.max(4, Math.min(16, Math.round(notes.length / 12)));

  return `Tienes ${notes.length} NOTAS numeradas extraídas de una conversación (charla/podcast/entrevista),
en orden cronológico. Diseña el ESQUELETO de un artículo editorial que las desarrolle TODAS.

${projectContext(project)}
Título provisional del usuario (puedes mejorarlo): ${project.provisionalTitle ?? 'ninguno'}

Devuelve un JSON { "title": string, "sections": [{ "heading": string, "noteRefs": number[] }] }:
- Entre ${Math.max(4, suggested - 2)} y ${suggested + 4} secciones temáticas, en un orden que fluya para el lector.
- "noteRefs": los NÚMEROS de las notas que cubre esa sección. CADA nota (1..${notes.length}) debe estar
  asignada exactamente a una sección; ninguna puede quedar sin asignar. Está bien que una nota de
  contexto aparezca en la sección introductoria.
- Los headings deben ser descriptivos y específicos del contenido, no genéricos.

NOTAS:
${numberedNotes(notes)}`;
}

/** Etapa 3: redactar UNA sección a fondo. Tarea acotada -> el modelo la desarrolla por completo. */
export function buildSectionPrompt(
  input: GenerateArticleInput,
  heading: string,
  sectionNotes: ExtractedNote[],
  position: { index: number; total: number },
): string {
  const { project } = input;
  const isIntro = position.index === 0;
  const isClose = position.index === position.total - 1;

  return `Escribe SOLO la sección "${heading}" de un artículo editorial (sección ${position.index + 1} de ${position.total}).

${projectContext(project)}
${project.callToAction && isClose ? `Cierra la sección integrando esta llamada a la acción de forma natural: ${project.callToAction}` : ''}
${project.primaryKeyword ? `Si encaja de forma natural, usa la expresión "${project.primaryKeyword}".` : ''}

Desarrolla en prosa TODOS los puntos de abajo, sin omitir ninguno: la idea, el porqué, los ejemplos
concretos, las cifras, los nombres, los matices y las conclusiones. Entre 3 y 7 párrafos completos
(cada párrafo, varias frases). ${isIntro ? 'Es la introducción: presenta el tema del artículo antes de entrar en detalle.' : 'No repitas lo ya dicho en secciones anteriores; entra directo al contenido de esta sección.'}
Usa "list" solo si los puntos enumeran elementos, y "quote" para reproducir una frase textual del orador.

${COMMON_RULES}

Devuelve un JSON { "blocks": [{ "type": "paragraph"|"list"|"quote", "text"?: string, "items"?: string[], "ordered"?: boolean }] }.
NO incluyas el heading (se añade aparte). NO devuelvas nada fuera de esta sección.

Puntos a desarrollar en esta sección:
${sectionNotes.map((n, i) => `${i + 1}. ${n.point}`).join('\n')}`;
}

/** Etapa 4: excerpt + FAQ + SEO + warnings, a partir del esqueleto y las notas. */
export function buildArticleMetaPrompt(
  input: GenerateArticleInput,
  outline: ArticleOutline,
  notes: ExtractedNote[],
): string {
  const { project } = input;

  return `Un artículo titulado "${outline.title}" desarrolla estas secciones:
${outline.sections.map((s) => `- ${s.heading}`).join('\n')}

${projectContext(project)}
${project.primaryKeyword ? `Palabra clave principal: ${project.primaryKeyword}` : ''}

A partir de las NOTAS de abajo (el contenido real de la conversación), devuelve un JSON:
{
  "excerpt": string,   // 1-2 frases que resuman de qué trata el artículo
  "faq": [{ "question": string, "answer": string, "noteRefs": number[] }],  // 3-6, respondidas con las notas
  "seo": { "title": string, "slug": string, "metaDescription": string, "primaryKeyword"?: string, "secondaryKeywords": string[] },
  "warnings": [{ "blockId": null, "type": "unsupported_claim"|"number_verification"|"name_verification"|"date_verification"|"possible_hallucination"|"missing_source", "message": string }]
}
- "noteRefs" de cada FAQ: los números de las notas que respaldan la respuesta.
- "warnings": cifras, nombres o fechas de las notas que convenga verificar (blockId siempre null aquí).

${COMMON_RULES}

NOTAS:
${numberedNotes(notes)}`;
}
