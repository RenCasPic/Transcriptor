import { describe, expect, it, vi } from 'vitest';
import { GroqTranscriptionProvider } from '@/lib/ai/transcription/groq-provider';
import { WhisperTranscriptionProvider } from '@/lib/ai/transcription/whisper-provider';
import { PROVIDER_REQUEST_MAX_BYTES } from '@/lib/media/limits';

describe('TranscriptionProvider.limits', () => {
  it('Groq y Whisper declaran el límite de 25 MB por petición y soportan troceado', () => {
    for (const provider of [new GroqTranscriptionProvider('k'), new WhisperTranscriptionProvider('k')]) {
      expect(provider.limits.maxRequestBytes).toBe(PROVIDER_REQUEST_MAX_BYTES);
      expect(provider.limits.supportsChunking).toBe(true);
    }
  });

  it('el rechazo por tamaño usa el límite declarado, no un número hardcodeado', async () => {
    const provider = new GroqTranscriptionProvider('k');
    const oversized = new Blob([new Uint8Array(provider.limits.maxRequestBytes + 1)]);
    await expect(
      provider.transcribe({ audioBlob: oversized, fileExtension: 'mp3', language: 'es' }),
    ).rejects.toThrow('TRANSCRIPTION_FILE_TOO_LARGE');
  });

  it('un blob dentro del límite no se rechaza por tamaño (llega a llamar al servicio)', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ text: 'ok', segments: [{ start: 0, end: 1, text: 'ok' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new GroqTranscriptionProvider('k');
    await provider.transcribe({
      audioBlob: new Blob([new Uint8Array(1024)]),
      fileExtension: 'mp3',
      language: 'es',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
