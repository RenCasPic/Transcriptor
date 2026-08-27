import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMediaLimits, PROVIDER_REQUEST_MAX_BYTES, MAX_MEDIA_BYTES } from '@/lib/media/limits';

afterEach(() => {
  vi.unstubAllEnvs();
});

const MB = 1024 * 1024;

describe('getMediaLimits', () => {
  it('usa defaults razonables sin configurar nada', () => {
    const limits = getMediaLimits();
    expect(limits.maxUploadBytes).toBe(500 * MB);
    expect(limits.maxDurationSeconds).toBe(6 * 60 * 60);
    expect(limits.chunkTargetBytes).toBe(20 * MB);
    expect(limits.chunkMaxSeconds).toBe(600);
    expect(limits.chunkAudioBitrateKbps).toBe(64);
  });

  it('respeta las variables de entorno', () => {
    vi.stubEnv('MEDIA_MAX_UPLOAD_MB', '1000');
    vi.stubEnv('MEDIA_CHUNK_MAX_SECONDS', '300');
    vi.stubEnv('MEDIA_CHUNK_AUDIO_BITRATE_KBPS', '96');
    const limits = getMediaLimits();
    expect(limits.maxUploadBytes).toBe(1000 * MB);
    expect(limits.chunkMaxSeconds).toBe(300);
    expect(limits.chunkAudioBitrateKbps).toBe(96);
  });

  it('ignora valores inválidos y cae al default', () => {
    vi.stubEnv('MEDIA_MAX_UPLOAD_MB', 'abc');
    vi.stubEnv('MEDIA_CHUNK_MAX_SECONDS', '-5');
    const limits = getMediaLimits();
    expect(limits.maxUploadBytes).toBe(500 * MB);
    expect(limits.chunkMaxSeconds).toBe(600);
  });

  it('el límite por petición del proveedor es una constante (25 MB) e independiente de la config de subida', () => {
    vi.stubEnv('MEDIA_MAX_UPLOAD_MB', '9999');
    expect(PROVIDER_REQUEST_MAX_BYTES).toBe(25 * MB);
    expect(MAX_MEDIA_BYTES).toBe(PROVIDER_REQUEST_MAX_BYTES);
  });
});
