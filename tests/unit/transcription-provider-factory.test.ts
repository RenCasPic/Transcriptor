import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTranscriptionProvider, isRealTranscriptionConfigured } from '@/lib/ai/transcription';
import { DemoTranscriptionProvider } from '@/lib/ai/transcription/demo-provider';
import { GroqTranscriptionProvider } from '@/lib/ai/transcription/groq-provider';
import { WhisperTranscriptionProvider } from '@/lib/ai/transcription/whisper-provider';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getTranscriptionProvider (selección demo vs. real)', () => {
  it('devuelve DemoTranscriptionProvider cuando TRANSCRIPTION_PROVIDER=demo', () => {
    vi.stubEnv('TRANSCRIPTION_PROVIDER', 'demo');
    expect(getTranscriptionProvider()).toBeInstanceOf(DemoTranscriptionProvider);
  });

  it('devuelve DemoTranscriptionProvider cuando no hay TRANSCRIPTION_PROVIDER configurado', () => {
    vi.stubEnv('TRANSCRIPTION_PROVIDER', undefined as unknown as string);
    expect(getTranscriptionProvider()).toBeInstanceOf(DemoTranscriptionProvider);
  });

  it('devuelve GroqTranscriptionProvider cuando TRANSCRIPTION_PROVIDER=groq con API key', () => {
    vi.stubEnv('TRANSCRIPTION_PROVIDER', 'groq');
    vi.stubEnv('TRANSCRIPTION_API_KEY', 'fake-key');
    expect(getTranscriptionProvider()).toBeInstanceOf(GroqTranscriptionProvider);
  });

  it('devuelve WhisperTranscriptionProvider cuando TRANSCRIPTION_PROVIDER=whisper con API key', () => {
    vi.stubEnv('TRANSCRIPTION_PROVIDER', 'whisper');
    vi.stubEnv('TRANSCRIPTION_API_KEY', 'fake-key');
    expect(getTranscriptionProvider()).toBeInstanceOf(WhisperTranscriptionProvider);
  });

  it('cae a Demo si TRANSCRIPTION_PROVIDER=groq pero falta la API key (evita romper el flujo)', () => {
    vi.stubEnv('TRANSCRIPTION_PROVIDER', 'groq');
    vi.stubEnv('TRANSCRIPTION_API_KEY', '');
    expect(getTranscriptionProvider()).toBeInstanceOf(DemoTranscriptionProvider);
  });
});

describe('isRealTranscriptionConfigured', () => {
  it('es false en modo demo', () => {
    vi.stubEnv('TRANSCRIPTION_PROVIDER', 'demo');
    expect(isRealTranscriptionConfigured()).toBe(false);
  });

  it('es true con groq + API key', () => {
    vi.stubEnv('TRANSCRIPTION_PROVIDER', 'groq');
    vi.stubEnv('TRANSCRIPTION_API_KEY', 'fake-key');
    expect(isRealTranscriptionConfigured()).toBe(true);
  });

  it('es false con groq sin API key', () => {
    vi.stubEnv('TRANSCRIPTION_PROVIDER', 'groq');
    vi.stubEnv('TRANSCRIPTION_API_KEY', '');
    expect(isRealTranscriptionConfigured()).toBe(false);
  });
});

describe('contrato compartido entre proveedores (mismo TranscriptResult)', () => {
  it('Demo y Groq devuelven exactamente la misma forma de resultado', async () => {
    // Groq real necesitaría red; se simula su respuesta HTTP para poder
    // comparar el contrato sin depender de una API externa en los tests.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          text: 'Texto de prueba',
          segments: [{ start: 0, end: 1.5, text: 'Texto de prueba' }],
        }),
      })),
    );

    const demoResult = await new DemoTranscriptionProvider().transcribe({ language: 'es' });
    const groqResult = await new GroqTranscriptionProvider('fake-key').transcribe({
      audioBlob: new Blob(['fake-audio']),
      fileExtension: 'webm',
      language: 'es',
    });

    const shapeOf = (value: unknown) => Object.keys(value as object).sort();
    expect(shapeOf(demoResult)).toEqual(shapeOf(groqResult));
    expect(shapeOf(demoResult.segments[0])).toEqual(shapeOf(groqResult.segments[0]));

    vi.unstubAllGlobals();
  });
});
