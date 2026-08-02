import { COMMON_RULES } from './rules';

/**
 * Prompt para el paso de detección de afirmaciones no respaldadas (cifras,
 * nombres, fechas, posibles alucinaciones) comparando el artículo generado
 * contra la transcripción fuente.
 */
export function buildClaimsDetectionPrompt(articlePlainText: string, transcriptFullText: string): string {
  return `Eres un verificador de contenido. Compara el artículo generado contra la transcripción original
y detecta afirmaciones que no estén claramente respaldadas.

Tipos de alerta posibles: unsupported_claim, number_verification, name_verification, date_verification,
possible_hallucination, missing_source.

${COMMON_RULES}

Para cada alerta, indica un fragmento identificable del artículo y un mensaje breve explicando por qué
debe revisarse.

Transcripción original:
"""
${transcriptFullText.slice(0, 8000)}
"""

Artículo generado:
"""
${articlePlainText.slice(0, 8000)}
"""`;
}
