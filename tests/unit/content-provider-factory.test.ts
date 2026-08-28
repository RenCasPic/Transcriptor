import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getContentGenerationProvider,
  isContentGenerationConfigured,
  AiNotConfiguredError,
} from '@/lib/ai/providers';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubOkJson(capture: (url: string, init: RequestInit) => void) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      capture(url, init);
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        clone() {
          return this;
        },
        text: async () => '',
        json: async () => ({ choices: [{ message: { content: '{"title":"t"}' } }] }),
      };
    }),
  );
}

describe('getContentGenerationProvider', () => {
  it('lanza AiNotConfiguredError si no hay AI_API_KEY (y el proveedor no es groq)', () => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('AI_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', 'gsk_xxx'); // no debe servir para openai
    expect(() => getContentGenerationProvider()).toThrow(AiNotConfiguredError);
  });

  it('por defecto usa OpenAI y el modelo gpt-4o-mini, con Authorization: Bearer <AI_API_KEY>', async () => {
    vi.stubEnv('AI_PROVIDER', undefined as unknown as string);
    vi.stubEnv('AI_API_KEY', 'sk-test-123');
    vi.stubEnv('AI_MODEL', '');

    let seenUrl = '';
    let seenBody: Record<string, unknown> = {};
    let seenAuth = '';
    stubOkJson((url, init) => {
      seenUrl = url;
      seenBody = JSON.parse(init.body as string);
      seenAuth = ((init.headers ?? {}) as Record<string, string>).authorization ?? '';
    });

    await getContentGenerationProvider().rewriteSection({
      text: 'hola',
      instruction: 'rewrite',
      tone: 'professional',
      language: 'es',
      audience: null,
      primaryKeyword: null,
    });

    expect(seenUrl).toBe('https://api.openai.com/v1/chat/completions');
    expect(seenBody.model).toBe('gpt-4o-mini');
    expect(seenAuth).toBe('Bearer sk-test-123');
  });

  it('AI_MODEL sobreescribe el modelo por defecto', async () => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('AI_API_KEY', 'sk-x');
    vi.stubEnv('AI_MODEL', 'gpt-4o');

    let model = '';
    stubOkJson((_url, init) => {
      model = (JSON.parse(init.body as string) as { model: string }).model;
    });
    await getContentGenerationProvider().rewriteSection({
      text: 'x',
      instruction: 'rewrite',
      tone: 'professional',
      language: 'es',
      audience: null,
      primaryKeyword: null,
    });
    expect(model).toBe('gpt-4o');
  });

  it('AI_PROVIDER=groq sí acepta GROQ_API_KEY como fallback', async () => {
    vi.stubEnv('AI_PROVIDER', 'groq');
    vi.stubEnv('AI_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', 'gsk_yyy');
    let url = '';
    stubOkJson((u) => {
      url = u;
    });
    await getContentGenerationProvider().rewriteSection({
      text: 'x',
      instruction: 'rewrite',
      tone: 'professional',
      language: 'es',
      audience: null,
      primaryKeyword: null,
    });
    expect(url).toContain('api.groq.com');
  });

  it('proveedor no soportado -> error', () => {
    vi.stubEnv('AI_PROVIDER', 'cohere');
    vi.stubEnv('AI_API_KEY', 'k');
    expect(() => getContentGenerationProvider()).toThrow(/UNSUPPORTED_AI_PROVIDER/);
  });
});

describe('isContentGenerationConfigured', () => {
  it('false sin AI_API_KEY para openai', () => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('AI_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', 'gsk_x');
    expect(isContentGenerationConfigured()).toBe(false);
  });
  it('true con AI_API_KEY', () => {
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('AI_API_KEY', 'sk-x');
    expect(isContentGenerationConfigured()).toBe(true);
  });
});
