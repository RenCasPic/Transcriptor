import { COMMON_RULES, toneInstruction } from './rules';
import type { RewriteSectionInput } from '@/lib/ai/provider';

const INSTRUCTION_GUIDANCE: Record<string, string> = {
  rewrite: 'Reescribe el texto manteniendo el mismo significado, con mejor fluidez.',
  shorten: 'Acorta el texto conservando únicamente las ideas esenciales.',
  expand: 'Expande el texto agregando claridad y contexto, sin inventar datos nuevos.',
  simplify: 'Simplifica el lenguaje para que sea más fácil de entender.',
  more_professional: 'Reescribe el texto con un registro más profesional.',
  more_conversational: 'Reescribe el texto con un registro más conversacional y cercano.',
  improve_seo: 'Mejora el texto para SEO integrando de forma natural la palabra clave principal, sin sobre-optimizar.',
  convert_to_list: 'Convierte el texto en una lista clara de puntos, conservando el contenido.',
  fix_grammar: 'Corrige la gramática y ortografía sin cambiar el significado ni el estilo.',
  regenerate: 'Redacta una versión completamente nueva de esta sección con el mismo propósito.',
};

/** Prompt para transformar una sección seleccionada del artículo dentro del editor. */
export function buildRewritePrompt(input: RewriteSectionInput): string {
  return `Eres un editor de contenido. Aplica la siguiente instrucción al texto seleccionado.

Instrucción: ${INSTRUCTION_GUIDANCE[input.instruction] ?? input.instruction}
${toneInstruction(input.tone)}
Audiencia: ${input.audience ?? 'general'}
Palabra clave principal (si aplica): ${input.primaryKeyword ?? 'ninguna'}
Idioma: ${input.language}

${COMMON_RULES}

Devuelve únicamente el texto resultante, sin explicaciones ni comillas envolventes.

Texto original:
"""
${input.text}
"""`;
}
