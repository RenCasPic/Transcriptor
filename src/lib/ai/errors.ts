/**
 * Clasificación de errores del proveedor de generación de IA (OpenAI, Anthropic,
 * Groq) a un conjunto pequeño de códigos accionables, y su mensaje de respaldo
 * en español.
 *
 * Los `ModelCaller` (`src/lib/ai/providers/generic-provider.ts`) lanzan errores
 * con la forma `AI_PROVIDER_HTTP_ERROR:{status}:{cuerpo}` (o códigos internos
 * como `AI_NOT_CONFIGURED`, `AI_TRANSCRIPT_TOO_LONG`). Aquí se traduce ese texto
 * crudo — que nunca se muestra al usuario tal cual — a un código estable que
 * tanto la Server Action (`generateArticleAction`) como el procesador de jobs
 * (`runTranscriptionJob`) usan para decidir qué mensaje enseñar. El mensaje
 * localizado final lo resuelve la UI a partir del código (i18n es/en); esta
 * función solo aporta el texto de respaldo para logs y consumidores no-UI.
 */

export const AI_ERROR_CODES = [
  'AI_NOT_CONFIGURED',
  'AI_PROVIDER_AUTH_ERROR',
  'AI_PROVIDER_QUOTA_ERROR',
  'AI_RATE_LIMITED',
  'AI_REQUEST_TOO_LARGE',
  'AI_TRANSCRIPT_TOO_LONG',
  'AI_MODEL_UNAVAILABLE',
  'AI_PROVIDER_TEMPORARY_ERROR',
  'AI_INVALID_RESPONSE',
  'GENERATION_FAILED',
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

const QUOTA_HINTS = /insufficient_quota|exceeded your current quota|billing_hard_limit|no_credits|credit balance is too low/i;
const AUTH_HINTS = /invalid_api_key|incorrect api key|invalid x-api-key|authentication|unauthorized|permission/i;
const CONTEXT_HINTS = /context_length_exceeded|maximum context length|reduce the length|request too large|request entity too large|too many tokens/i;

/**
 * Devuelve un `AiErrorCode` a partir del mensaje crudo lanzado por un
 * `ModelCaller`. `AI_PROVIDER_QUOTA_ERROR` se distingue de `AI_RATE_LIMITED`
 * porque OpenAI devuelve 429 para ambos casos: solo el cuerpo los diferencia.
 */
export function classifyAiError(raw: string): AiErrorCode {
  if (raw === 'AI_NOT_CONFIGURED') return 'AI_NOT_CONFIGURED';
  if (raw === 'AI_TRANSCRIPT_TOO_LONG') return 'AI_TRANSCRIPT_TOO_LONG';
  if (raw.startsWith('AI_PROVIDER_INVALID_ARTICLE_RESPONSE') || raw.startsWith('AI_PROVIDER_INVALID_SEO_RESPONSE')) {
    return 'AI_INVALID_RESPONSE';
  }
  if (raw === 'AI_PROVIDER_EMPTY_RESPONSE') return 'AI_INVALID_RESPONSE';

  const httpMatch = /^AI_PROVIDER_HTTP_ERROR:(\d{3})(?::([\s\S]*))?$/.exec(raw);
  if (httpMatch) {
    const status = Number(httpMatch[1]);
    const body = httpMatch[2] ?? '';

    if (status === 401 || status === 403 || AUTH_HINTS.test(body)) return 'AI_PROVIDER_AUTH_ERROR';
    if (status === 402 || QUOTA_HINTS.test(body)) return 'AI_PROVIDER_QUOTA_ERROR';
    if (status === 429) return 'AI_RATE_LIMITED';
    if (status === 413 || (status === 400 && CONTEXT_HINTS.test(body))) return 'AI_REQUEST_TOO_LARGE';
    if (status === 404) return 'AI_MODEL_UNAVAILABLE';
    if (status >= 500) return 'AI_PROVIDER_TEMPORARY_ERROR';
    if (CONTEXT_HINTS.test(body)) return 'AI_REQUEST_TOO_LARGE';
    return 'GENERATION_FAILED';
  }

  if (raw.startsWith('AI_PROVIDER_')) return 'GENERATION_FAILED';
  return 'GENERATION_FAILED';
}

/** Texto de respaldo en español para cada código (la UI localiza a partir del código). */
export function aiErrorMessageEs(code: AiErrorCode): string {
  switch (code) {
    case 'AI_NOT_CONFIGURED':
      return 'Falta configurar la API key de IA (AI_API_KEY). Añádela en tu archivo .env y reinicia el servidor.';
    case 'AI_PROVIDER_AUTH_ERROR':
      return 'La API key de IA es inválida o no tiene permisos. Revisa AI_API_KEY (debe empezar por "sk-" para OpenAI).';
    case 'AI_PROVIDER_QUOTA_ERROR':
      return 'La cuenta del proveedor de IA se quedó sin créditos. Añade saldo en tu cuenta de OpenAI (Billing) y reintenta.';
    case 'AI_RATE_LIMITED':
      return 'Se alcanzó el límite de peticiones del proveedor de IA. Espera un minuto y vuelve a pulsar "Generar artículo".';
    case 'AI_REQUEST_TOO_LARGE':
      return 'La transcripción supera la capacidad de contexto del modelo. Usa un modelo con más contexto (AI_MODEL) o divide el audio en partes más cortas.';
    case 'AI_TRANSCRIPT_TOO_LONG':
      return 'La transcripción es excepcionalmente larga y supera el límite configurado (AI_MAX_PROMPT_TOKENS). Divide el audio en partes más cortas.';
    case 'AI_MODEL_UNAVAILABLE':
      return 'El modelo de IA configurado no existe o no está disponible para tu cuenta. Revisa AI_MODEL.';
    case 'AI_PROVIDER_TEMPORARY_ERROR':
      return 'El servicio de IA tuvo un error temporal. Espera unos minutos y vuelve a pulsar "Generar artículo".';
    case 'AI_INVALID_RESPONSE':
      return 'El proveedor de IA devolvió una respuesta con un formato inesperado. Inténtalo de nuevo.';
    case 'GENERATION_FAILED':
    default:
      return 'No se pudo generar el artículo. Inténtalo de nuevo.';
  }
}
