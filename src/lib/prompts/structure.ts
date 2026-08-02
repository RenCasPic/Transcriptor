import { COMMON_RULES } from './rules';
import type { GenerateArticleInput } from '@/lib/ai/provider';

/** Prompt para el paso de creación de estructura (esqueleto de H2/H3) previo a la redacción. */
export function buildStructurePrompt(input: GenerateArticleInput): string {
  const { project, transcript } = input;

  return `Eres un editor experto en convertir transcripciones en estructuras de artículo de blog.

Tipo de contenido: ${project.contentType}
Audiencia: ${project.audience ?? 'general'}
Objetivo del artículo: ${project.objective ?? 'informar de manera clara y útil'}
Idioma: ${project.language}

A partir de la siguiente transcripción, propone una estructura de artículo con:
- Un título principal.
- Entre 3 y 7 encabezados H2, cada uno con 0-2 subencabezados H3 si es necesario.
- Para cada encabezado, indica qué segmentos de la transcripción (por índice) debe cubrir.

No redactes el contenido todavía, solo la estructura.

${COMMON_RULES}

Transcripción (segmentos indexados):
${transcript.segments.map((s) => `[${s.index}] ${s.speaker ? `${s.speaker}: ` : ''}${s.text}`).join('\n')}`;
}
