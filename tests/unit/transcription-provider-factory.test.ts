import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getTranscriptionProvider,
  isTranscriptionConfigured,
  TranscriptionNotConfiguredError,
} from '@/lib/ai/transcription';
import { GroqTranscriptionProvider } from '@/lib/ai/transcription/groq-provider';
import { WhisperTranscriptionProvider } from '@/lib/ai/transcription/whisper-provider';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getTranscriptionProvider', () => {
  it('lanza TranscriptionNotConfiguredError si no hay ninguna API key', () => {
    vi.stubEnv('TRANSCRIPTION_PROVIDER', 'groq');
    vi.stubEnv('TRANSCRIPTION_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', '');
    expect(() => getTranscriptionProvider()).toThrow(TranscriptionNotConfiguredError);
  });

  it('por defecto usa Groq cuando hay API key', () => {
    vi.stubEnv('TRANSCRIPTION_PROVIDER', undefined as unknown as string);
    vi.stubEnv('TRANSCRIPTION_API_KEY', 'fake-key');
    expect(getTranscriptionProvider()).toBeInstanceOf(GroqTranscriptionProvider);
  });

  it('usa Whisper cuando TRANSCRIPTION_PROVIDER=whisper', () => {
    vi.stubEnv('TRANSCRIPTION_PROVIDER', 'whisper');
    vi.stubEnv('TRANSCRIPTION_API_KEY', 'fake-key');
    expect(getTranscriptionProvider()).toBeInstanceOf(WhisperTranscriptionProvider);
  });

  it('acepta GROQ_API_KEY como clave compartida cuando no hay TRANSCRIPTION_API_KEY', () => {
    vi.stubEnv('TRANSCRIPTION_PROVIDER', 'groq');
    vi.stubEnv('TRANSCRIPTION_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', 'shared-key');
    expect(getTranscriptionProvider()).toBeInstanceOf(GroqTranscriptionProvider);
  });

  it('lanza para un proveedor no soportado', () => {
    vi.stubEnv('TRANSCRIPTION_PROVIDER', 'deepgram');
    vi.stubEnv('TRANSCRIPTION_API_KEY', 'fake-key');
    expect(() => getTranscriptionProvider()).toThrow(/UNSUPPORTED_TRANSCRIPTION_PROVIDER/);
  });
});

describe('isTranscriptionConfigured', () => {
  it('es false sin ninguna clave', () => {
    vi.stubEnv('TRANSCRIPTION_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', '');
    expect(isTranscriptionConfigured()).toBe(false);
  });

  it('es true con TRANSCRIPTION_API_KEY', () => {
    vi.stubEnv('TRANSCRIPTION_API_KEY', 'k');
    expect(isTranscriptionConfigured()).toBe(true);
  });

  it('es true solo con GROQ_API_KEY', () => {
    vi.stubEnv('TRANSCRIPTION_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', 'k');
    expect(isTranscriptionConfigured()).toBe(true);
  });
});

describe('contrato compartido entre proveedores reales', () => {
  it('Groq y Whisper devuelven la misma forma de TranscriptResult', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ text: 'Texto de prueba', segments: [{ start: 0, end: 1.5, text: 'Texto de prueba' }] }),
      })),
    );

    const groq = await new GroqTranscriptionProvider('k').transcribe({
      audioBlob: new Blob(['x']),
      fileExtension: 'mp3',
      language: 'es',
    });
    const whisper = await new WhisperTranscriptionProvider('k').transcribe({
      audioBlob: new Blob(['x']),
      fileExtension: 'mp3',
      language: 'es',
    });

    const shapeOf = (v: unknown) => Object.keys(v as object).sort();
    expect(shapeOf(groq)).toEqual(shapeOf(whisper));
    expect(shapeOf(groq.segments[0])).toEqual(shapeOf(whisper.segments[0]));
    vi.unstubAllGlobals();
  });
});
