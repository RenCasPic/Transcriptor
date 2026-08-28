import type { TranscriptSegmentInput } from '@/lib/ai/provider';

/**
 * Etapa 1 de la generación en dos etapas (para transcripciones largas):
 * extracción estructurada de un BLOQUE de segmentos. El objetivo es NO perder
 * información — se extrae cada idea, argumento, ejemplo, dato y cita, con su
 * etiqueta de segmento — para que la etapa 2 redacte a partir de todo el
 * material y no solo de lo que el modelo "recuerde" de una transcripción larga.
 */
export function buildExtractionPrompt(segments: TranscriptSegmentInput[], language: string): string {
  return `Estás procesando un FRAGMENTO de una transcripción más larga. Extrae su contenido SIN RESUMIR
y sin omitir nada relevante.

Devuelve un JSON { "notes": [{ "point": string, "sourceSegmentIds": string[] }] } donde cada "point"
es una afirmación concreta y autocontenida tomada del fragmento:
- cada idea o tesis que se expone,
- cada argumento o razón que se da,
- cada ejemplo concreto, caso o anécdota,
- cada cifra, fecha, nombre propio, lugar o referencia,
- cada cita textual relevante (entre comillas, literal),
- el contexto necesario para entender el punto,
- cada conclusión o recomendación.

Reglas:
- Un "point" por idea. No agrupes varias ideas distintas en una sola nota.
- Redacta cada "point" como una frase clara y completa en ${language}, no como palabras sueltas.
- NO interpretes ni añadas información que no esté en el fragmento.
- Ignora solo: saludos, despedidas, muletillas, titubeos y repeticiones literales.
- "sourceSegmentIds": las etiquetas (p. ej. "s12") de los segmentos que respaldan esa nota; copia la
  etiqueta EXACTA que aparece entre corchetes al inicio de cada línea.
- Es mejor extraer de más que de menos: si dudas, incluye la nota.

Fragmento de la transcripción:
${segments.map((s) => `[s${s.index}] ${s.speaker ? `${s.speaker}: ` : ''}${s.text}`).join('\n')}`;
}
