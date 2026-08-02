/**
 * Reglas comunes que deben incluirse en TODOS los prompts de generación de
 * contenido. Centralizadas aquí para que cualquier cambio de política se
 * propague a todos los prompts sin editarlos uno por uno.
 */
export const COMMON_RULES = `Reglas obligatorias:
- No inventes información que no esté en la transcripción: nombres, cifras, fechas, citas o testimonios deben coincidir exactamente con la fuente.
- Si una afirmación no está suficientemente respaldada por la transcripción, señala la incertidumbre en lugar de presentarla como un hecho.
- No agregues citas, estadísticas o fuentes que no aparezcan en el material original.
- No afirmes que una recomendación garantiza resultados; usa lenguaje probabilístico y matizado cuando corresponda.
- Escribe siempre en el idioma solicitado.
- Respeta estrictamente la audiencia, el tono y el objetivo indicados.
- Evita introducciones genéricas ("En el mundo actual...", "Hoy en día...") y frases de relleno.
- No repitas la misma idea con distintas palabras dentro del mismo artículo.
- Devuelve siempre el resultado en el formato estructurado solicitado, sin texto adicional fuera de esa estructura.`;

export function toneInstruction(tone: string): string {
  const map: Record<string, string> = {
    professional: 'Usa un tono profesional, claro y directo, sin coloquialismos.',
    educational: 'Usa un tono educativo, explicando conceptos paso a paso como si enseñaras a alguien nuevo en el tema.',
    conversational: 'Usa un tono conversacional, cercano, como si hablaras con un colega.',
    persuasive: 'Usa un tono persuasivo orientado a la acción, sin exagerar ni prometer resultados garantizados.',
    technical: 'Usa un tono técnico y preciso, apropiado para un lector especializado.',
    friendly: 'Usa un tono cercano y cálido, evitando la jerga corporativa.',
  };
  return map[tone] ?? map.professional!;
}
