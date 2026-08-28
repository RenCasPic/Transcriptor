import { describe, expect, it } from 'vitest';
import { classifyAiError, aiErrorMessageEs, AI_ERROR_CODES } from '@/lib/ai/errors';

const http = (status: number, body = '') => `AI_PROVIDER_HTTP_ERROR:${status}:${body}`;

describe('classifyAiError', () => {
  it('401 / 403 / mención de API key inválida -> AI_PROVIDER_AUTH_ERROR', () => {
    expect(classifyAiError(http(401))).toBe('AI_PROVIDER_AUTH_ERROR');
    expect(classifyAiError(http(403))).toBe('AI_PROVIDER_AUTH_ERROR');
    expect(classifyAiError(http(400, '{"error":{"code":"invalid_api_key"}}'))).toBe('AI_PROVIDER_AUTH_ERROR');
  });

  it('falta de saldo -> AI_PROVIDER_QUOTA_ERROR (aunque OpenAI lo devuelva como 429)', () => {
    expect(classifyAiError(http(429, 'You exceeded your current quota, check your plan'))).toBe(
      'AI_PROVIDER_QUOTA_ERROR',
    );
    expect(classifyAiError(http(402))).toBe('AI_PROVIDER_QUOTA_ERROR');
    expect(classifyAiError(http(400, 'insufficient_quota'))).toBe('AI_PROVIDER_QUOTA_ERROR');
  });

  it('429 sin indicio de cuota -> AI_RATE_LIMITED', () => {
    expect(classifyAiError(http(429, 'Rate limit reached, try again in 2s'))).toBe('AI_RATE_LIMITED');
  });

  it('413 o 400 con "context_length_exceeded" -> AI_REQUEST_TOO_LARGE', () => {
    expect(classifyAiError(http(413, 'Request Entity Too Large'))).toBe('AI_REQUEST_TOO_LARGE');
    expect(classifyAiError(http(400, 'This model\'s maximum context length is 128000 tokens'))).toBe(
      'AI_REQUEST_TOO_LARGE',
    );
    expect(classifyAiError(http(400, '{"code":"context_length_exceeded"}'))).toBe('AI_REQUEST_TOO_LARGE');
  });

  it('404 -> AI_MODEL_UNAVAILABLE', () => {
    expect(classifyAiError(http(404, 'The model `foo` does not exist'))).toBe('AI_MODEL_UNAVAILABLE');
  });

  it('5xx -> AI_PROVIDER_TEMPORARY_ERROR', () => {
    for (const s of [500, 502, 503, 529]) expect(classifyAiError(http(s))).toBe('AI_PROVIDER_TEMPORARY_ERROR');
  });

  it('códigos internos se mapean directo', () => {
    expect(classifyAiError('AI_NOT_CONFIGURED')).toBe('AI_NOT_CONFIGURED');
    expect(classifyAiError('AI_TRANSCRIPT_TOO_LONG')).toBe('AI_TRANSCRIPT_TOO_LONG');
    expect(classifyAiError('AI_PROVIDER_INVALID_ARTICLE_RESPONSE:foo')).toBe('AI_INVALID_RESPONSE');
    expect(classifyAiError('AI_PROVIDER_EMPTY_RESPONSE')).toBe('AI_INVALID_RESPONSE');
  });

  it('cualquier otra cosa -> GENERATION_FAILED', () => {
    expect(classifyAiError('algo raro')).toBe('GENERATION_FAILED');
    expect(classifyAiError(http(418))).toBe('GENERATION_FAILED');
  });
});

describe('aiErrorMessageEs', () => {
  it('tiene un mensaje no vacío para cada código', () => {
    for (const code of AI_ERROR_CODES) {
      expect(aiErrorMessageEs(code).length).toBeGreaterThan(10);
    }
  });

  it('los mensajes de fallo recuperable mencionan "Generar artículo"', () => {
    expect(aiErrorMessageEs('AI_RATE_LIMITED')).toMatch(/Generar art/i);
    expect(aiErrorMessageEs('AI_PROVIDER_TEMPORARY_ERROR')).toMatch(/Generar art/i);
  });
});
