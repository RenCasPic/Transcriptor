/**
 * Plantillas de organización y formato por TIPO DE ARTÍCULO. Cada tipo define:
 *  - cómo se ORGANIZA el artículo (qué secciones y en qué orden),
 *  - el FORMATO de los bloques (cuándo usar listas numeradas, viñetas, citas, preguntas...),
 *  - cuántas preguntas frecuentes (FAQ) lleva, si lleva.
 * Se inyectan en los prompts de generación (`article.ts`): una sola llamada para
 * transcripciones cortas, y esqueleto / sección / metadatos para las largas.
 *
 * Los nombres de las secciones fijas (p. ej. "Contexto", "Resultados") se
 * traducen al idioma del artículo.
 */

export interface ContentTypeBlueprint {
  /** Organización del artículo: secciones y orden. */
  structure: string;
  /** Formato de los bloques: cuándo usar listas, citas, tipo de encabezados. */
  format: string;
  /** Instrucciones extra para diseñar el esqueleto (artículos largos). */
  outline: string;
  /** Instrucciones extra para redactar CADA sección (artículos largos). */
  section: string;
  /** Rango de preguntas frecuentes; `max: 0` = sin FAQ. */
  faq: { min: number; max: number };
  /** Cómo deben ser las preguntas frecuentes de este tipo. */
  faqStyle: string;
}

export const CONTENT_TYPE_BLUEPRINTS: Record<string, ContentTypeBlueprint> = {
  tutorial: {
    structure:
      'Organización TUTORIAL: introducción breve (qué se va a lograr y para quién) → requisitos o materiales (solo si la fuente los menciona) → los PASOS en orden cronológico, un encabezado H2 por paso o fase ("Paso 1: …", "Paso 2: …") → errores comunes o consejos (si la fuente los da) → conclusión con el siguiente paso.',
    format:
      'Formato TUTORIAL: instrucciones en imperativo y segunda persona. Dentro de cada paso, las acciones concretas y secuenciales van en una LISTA NUMERADA (list con ordered: true); los párrafos solo explican el porqué o dan contexto. Evita citas largas.',
    outline:
      'Cada sección es un PASO o fase del proceso, en el orden en que ocurre, con el encabezado "Paso N: <acción>" (adaptado al idioma del artículo). La primera sección es la introducción (y los requisitos, si los hay) y la última, la conclusión.',
    section:
      'Si esta sección es un paso, escribe primero 1 párrafo corto de contexto y después las acciones como lista numerada (ordered: true), una acción por elemento y en orden. Añade al final del paso la advertencia o consejo de la fuente, si existe.',
    faq: { min: 3, max: 5 },
    faqStyle: 'problemas frecuentes y dudas al seguir los pasos, con su solución según la fuente',
  },
  guide: {
    structure:
      'Organización GUÍA: introducción (qué cubre y por qué importa) → conceptos básicos → desarrollo temático de LO GENERAL A LO ESPECÍFICO, una sección H2 por tema y H3 para subtemas → recomendaciones prácticas o checklist final → conclusión.',
    format:
      'Formato GUÍA: prosa explicativa clara; listas con viñetas (ordered: false) solo para enumeraciones breves de elementos; una cita (quote) solo cuando una frase textual aporte autoridad.',
    outline:
      'Ordena las secciones de lo general a lo específico (conceptos → aplicación → recomendaciones). Incluye al final una sección de recomendaciones o checklist si la fuente da consejos.',
    section:
      'Explica el tema con claridad y profundidad, definiciones primero y ejemplos después. Usa una lista con viñetas para resumir puntos enumerables.',
    faq: { min: 3, max: 6 },
    faqStyle: 'dudas habituales de quien lee la guía por primera vez',
  },
  list: {
    structure:
      'Organización LISTADO: introducción de 1 párrafo que explique el criterio de la lista → cada ELEMENTO es un encabezado H2 NUMERADO ("1. …", "2. …") con 1 a 3 párrafos autosuficientes → conclusión breve. Sin secciones de relleno.',
    format:
      'Formato LISTADO: encabezados numerados y breves; cada elemento se entiende por sí solo y empieza con la idea clave en la primera frase. Evita listas anidadas.',
    outline:
      'Cada sección es UN ELEMENTO de la lista, con el encabezado numerado ("1. …", "2. …") en orden de importancia o de aparición. Una introducción inicial (sin número) y una conclusión final (sin número).',
    section:
      'Desarrolla SOLO este elemento: idea clave en la primera frase y luego 1 a 3 párrafos con el porqué y un ejemplo de la fuente. No compares con otros elementos.',
    faq: { min: 2, max: 4 },
    faqStyle: 'preguntas sobre cómo elegir, comparar o aplicar los elementos de la lista',
  },
  interview: {
    structure:
      'Organización ENTREVISTA: presentación de la persona entrevistada y del contexto → bloques TEMÁTICOS como H2 (cada uno basado en lo que se le preguntó) → dentro de cada bloque, alterna un resumen en prosa con CITAS TEXTUALES atribuidas → cierre con la reflexión o frase final.',
    format:
      'Formato ENTREVISTA: narra en tercera persona ("según explica …") y usa MUCHAS citas (quote) con las frases textuales más reveladoras de cada persona, siempre atribuidas con su nombre. Conserva la voz y las afirmaciones de cada quien; no atribuyas a una persona lo que dijo otra.',
    outline:
      'Cada sección es un TEMA de la conversación, nombrado como la pregunta o el asunto tratado. La primera sección presenta a la persona entrevistada y el contexto; la última recoge la reflexión final.',
    section:
      'Combina un párrafo que resuma lo que dice la persona con 1 o 2 citas (quote) textuales atribuidas. Mantén la voz de cada persona y atribuye cada afirmación a quien la hizo.',
    faq: { min: 2, max: 4 },
    faqStyle: 'preguntas que un lector se haría tras conocer a la persona entrevistada y sus ideas',
  },
  summary: {
    structure:
      'Organización RESUMEN: resumen ejecutivo de 2 a 3 frases al inicio → PUNTOS CLAVE en lista con viñetas → secciones cortas por tema (1 a 2 párrafos cada una) → conclusión de 1 párrafo. Pocas secciones y sin relleno.',
    format:
      'Formato RESUMEN: conciso y escaneable; frases directas; la lista de puntos clave es obligatoria; sin repeticiones ni anécdotas largas, pero sin perder los matices relevantes.',
    outline:
      'Usa POCAS secciones (3 a 5): "Resumen" o "Puntos clave" primero, luego un tema por sección y, al final, la conclusión.',
    section:
      'Sé breve: 1 a 2 párrafos por sección, o una lista con viñetas para los puntos clave. Prioriza las ideas más importantes y los datos concretos sobre los detalles anecdóticos.',
    faq: { min: 2, max: 3 },
    faqStyle: 'preguntas rápidas cuya respuesta sea un dato o una idea clave',
  },
  case_study: {
    structure:
      'Organización CASO DE ESTUDIO, con estas secciones FIJAS y en este orden: CONTEXTO (quién, de dónde parte) → PROBLEMA o desafío → SOLUCIÓN aplicada (qué se hizo y cómo) → RESULTADOS obtenidos → APRENDIZAJES o conclusiones. Omite solo las que la fuente no cubra en absoluto.',
    format:
      'Formato CASO DE ESTUDIO: narración en tercera persona y tiempo pasado; los resultados con cifras van en una lista con viñetas, SOLO con los números que la fuente da (nunca inventes métricas); una cita (quote) del protagonista para la frase más significativa.',
    outline:
      'Usa EXACTAMENTE estas secciones, traducidas al idioma del artículo y en este orden: Contexto, Problema, Solución, Resultados, Aprendizajes (omite una solo si no hay ninguna nota que la cubra).',
    section:
      'Escribe esta parte del caso en tercera persona y tiempo pasado. En "Resultados", lista las cifras exactas que da la fuente; si no hay cifras, describe los resultados cualitativamente sin inventar números.',
    faq: { min: 2, max: 4 },
    faqStyle: 'preguntas sobre cómo replicar el caso o qué resultados esperar, según la fuente',
  },
  opinion: {
    structure:
      'Organización OPINIÓN: gancho y TESIS (la postura expuesta) → ARGUMENTOS principales, un H2 por argumento → objeciones o contraargumentos y cómo se responden → conclusión con el posicionamiento final.',
    format:
      'Formato OPINIÓN: prosa argumentativa atribuida a quien habla ("sostiene que …"); usa citas (quote) para las afirmaciones más contundentes; deja claro que es una perspectiva y NO la presentes como consenso ni como un hecho establecido.',
    outline:
      'La primera sección expone la tesis; después, una sección por ARGUMENTO; luego una sección de objeciones y respuestas (si la fuente las toca) y, al final, la conclusión.',
    section:
      'Desarrolla el argumento con sus razones y ejemplos tal como los plantea la fuente, atribuidos a quien habla. Si hay una frase contundente textual, reprodúcela como quote.',
    faq: { min: 0, max: 0 },
    faqStyle: '',
  },
  qa: {
    structure:
      'Organización PREGUNTAS Y RESPUESTAS: introducción de 1 párrafo → cada PREGUNTA es un encabezado H2 redactado como pregunta → su respuesta DIRECTA en 1 a 3 párrafos (la primera frase ya responde) → H3 solo si una pregunta tiene subpreguntas. El cuerpo ya ES el formato de preguntas frecuentes.',
    format:
      'Formato PREGUNTAS Y RESPUESTAS: los encabezados terminan en signo de interrogación; cada respuesta empieza respondiendo y luego amplía con ejemplos de la fuente; sin introducciones largas.',
    outline:
      'Cada sección es UNA PREGUNTA, con el encabezado redactado como pregunta (con signos de interrogación), en el orden en que se plantean. Una introducción breve al inicio.',
    section:
      'Responde a la pregunta del encabezado: la primera frase contesta directamente y los párrafos siguientes amplían con los ejemplos, razones y matices de la fuente.',
    faq: { min: 0, max: 0 },
    faqStyle: '',
  },
};

const FALLBACK_TYPE = 'guide';

export function contentTypeBlueprint(type: string): ContentTypeBlueprint {
  return CONTENT_TYPE_BLUEPRINTS[type] ?? CONTENT_TYPE_BLUEPRINTS[FALLBACK_TYPE]!;
}

/** Bloque de instrucciones (organización + formato) de un tipo, para cualquier prompt de generación. */
export function contentTypeInstructions(type: string): string {
  const blueprint = contentTypeBlueprint(type);
  return `Tipo de contenido: ${type}.\n${blueprint.structure}\n${blueprint.format}`;
}

/** Línea del prompt que define las preguntas frecuentes (o su ausencia) para un tipo. */
export function faqInstruction(type: string, source: 'transcripción' | 'notas' = 'transcripción'): string {
  const { faq, faqStyle } = contentTypeBlueprint(type);
  if (faq.max === 0) {
    return `- faq: [] (lista vacía). Este tipo de artículo NO lleva sección de preguntas frecuentes aparte.`;
  }
  return `- faq: ${faq.min}-${faq.max} preguntas frecuentes (${faqStyle}), respondidas con la información de la ${source}.`;
}
