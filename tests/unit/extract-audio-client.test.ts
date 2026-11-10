import { beforeEach, describe, expect, it, vi } from 'vitest';

const MB = 1024 * 1024;
const THRESHOLD = 15 * MB;

const execMock = vi.fn();
const readFileMock = vi.fn();

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFFSType: { WORKERFS: 'WORKERFS' },
  FFmpeg: class {
    load = vi.fn().mockResolvedValue(undefined);
    on = vi.fn();
    off = vi.fn();
    createDir = vi.fn().mockResolvedValue(undefined);
    mount = vi.fn().mockResolvedValue(undefined);
    unmount = vi.fn().mockResolvedValue(undefined);
    deleteFile = vi.fn().mockResolvedValue(undefined);
    terminate = vi.fn();
    exec = (args: string[]) => execMock(args);
    readFile = (name: string) => readFileMock(name);
  },
}));
vi.mock('@ffmpeg/util', () => ({
  toBlobURL: vi.fn().mockResolvedValue('blob:mock'),
}));

async function load() {
  vi.resetModules();
  return import('@/lib/media/extract-audio-client');
}

function fakeVideo(name: string, size = 100 * MB): File {
  const file = new File(['x'], name, { type: 'video/mp4' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

beforeEach(() => {
  execMock.mockReset();
  readFileMock.mockReset();
});

describe('shouldExtractAudio', () => {
  it('NO extrae un audio pequeño (se sube tal cual)', async () => {
    const { shouldExtractAudio } = await load();
    expect(shouldExtractAudio('charla.mp3', 8 * MB, THRESHOLD)).toBe(false);
    expect(shouldExtractAudio('nota.m4a', THRESHOLD, THRESHOLD)).toBe(false);
  });

  it('SÍ extrae un audio grande', async () => {
    const { shouldExtractAudio } = await load();
    expect(shouldExtractAudio('podcast.mp3', 40 * MB, THRESHOLD)).toBe(true);
    expect(shouldExtractAudio('entrevista.wav', 300 * MB, THRESHOLD)).toBe(true);
  });

  it('NO extrae un video mp4/webm de hasta 20 MB (se sube tal cual)', async () => {
    const { shouldExtractAudio } = await load();
    expect(shouldExtractAudio('clip.mp4', 2 * MB, THRESHOLD)).toBe(false);
    expect(shouldExtractAudio('clip.mp4', 20 * MB, THRESHOLD)).toBe(false);
    expect(shouldExtractAudio('screencast.webm', 12 * MB, THRESHOLD)).toBe(false);
  });

  it('SÍ extrae un video mp4/webm de más de 20 MB', async () => {
    const { shouldExtractAudio } = await load();
    expect(shouldExtractAudio('clip.mp4', 21 * MB, THRESHOLD)).toBe(true);
    expect(shouldExtractAudio('screencast.webm', 500 * MB, THRESHOLD)).toBe(true);
  });

  it('SÍ extrae siempre mov/mkv/m4v, por pequeños que sean (los proveedores no los aceptan directo)', async () => {
    const { shouldExtractAudio } = await load();
    expect(shouldExtractAudio('grabacion.mkv', 1 * MB, THRESHOLD)).toBe(true);
    expect(shouldExtractAudio('iphone.mov', 3 * MB, THRESHOLD)).toBe(true);
    expect(shouldExtractAudio('clip.m4v', 3 * MB, THRESHOLD)).toBe(true);
  });

  it('trata un formato desconocido como "hay que intentar extraer"', async () => {
    const { shouldExtractAudio } = await load();
    expect(shouldExtractAudio('archivo.xyz', 1 * MB, THRESHOLD)).toBe(true);
  });
});

describe('remuxTargetFor', () => {
  it('elige el contenedor de audio según el del video', async () => {
    const { remuxTargetFor } = await load();
    expect(remuxTargetFor('mp4')).toEqual({ extension: 'm4a', mimeType: 'audio/mp4' });
    expect(remuxTargetFor('MOV')).toEqual({ extension: 'm4a', mimeType: 'audio/mp4' });
    expect(remuxTargetFor('mkv')).toEqual({ extension: 'm4a', mimeType: 'audio/mp4' });
    expect(remuxTargetFor('webm')).toEqual({ extension: 'webm', mimeType: 'audio/webm' });
    expect(remuxTargetFor('mp3')).toBeNull();
  });
});

describe('prepareMediaForUpload', () => {
  it('sube tal cual un video mp4 chico, sin cargar ffmpeg', async () => {
    const { prepareMediaForUpload } = await load();
    const file = fakeVideo('clip.mp4', 5 * MB);
    const result = await prepareMediaForUpload(file, { skipExtractBelowBytes: THRESHOLD });
    expect(result).toEqual({ file, wasExtracted: false });
    expect(execMock).not.toHaveBeenCalled();
  });

  it('copia el audio sin recomprimir (camino rápido) cuando cabe en el límite', async () => {
    const { prepareMediaForUpload } = await load();
    execMock.mockResolvedValue(0);
    readFileMock.mockResolvedValue(new Uint8Array(10 * MB));

    const result = await prepareMediaForUpload(fakeVideo('charla.mp4'), {
      skipExtractBelowBytes: THRESHOLD,
      remuxMaxBytes: 25 * MB,
    });

    expect(execMock).toHaveBeenCalledOnce();
    const args = execMock.mock.calls[0]![0] as string[];
    expect(args).toContain('copy');
    expect(args).not.toContain('libmp3lame');
    expect(result.wasExtracted).toBe(true);
    expect(result.file.name).toBe('charla.m4a');
    expect(result.file.type).toBe('audio/mp4');
  });

  it('si el audio copiado supera el límite, recomprime a MP3', async () => {
    const { prepareMediaForUpload } = await load();
    execMock.mockResolvedValue(0);
    readFileMock
      .mockResolvedValueOnce(new Uint8Array(30 * MB)) // copia: demasiado grande
      .mockResolvedValueOnce(new Uint8Array(12 * MB)); // MP3

    const result = await prepareMediaForUpload(fakeVideo('largo.mp4'), {
      skipExtractBelowBytes: THRESHOLD,
      remuxMaxBytes: 25 * MB,
    });

    expect(execMock).toHaveBeenCalledTimes(2);
    expect(execMock.mock.calls[0]![0]).toContain('copy');
    expect(execMock.mock.calls[1]![0]).toContain('libmp3lame');
    expect(result.file.name).toBe('largo.mp3');
    expect(result.file.type).toBe('audio/mpeg');
  });

  it('si la copia falla (códec incompatible), recomprime a MP3', async () => {
    const { prepareMediaForUpload } = await load();
    execMock.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    readFileMock.mockResolvedValue(new Uint8Array(8 * MB));

    const result = await prepareMediaForUpload(fakeVideo('raro.webm'), { skipExtractBelowBytes: THRESHOLD });

    expect(execMock).toHaveBeenCalledTimes(2);
    expect(execMock.mock.calls[1]![0]).toContain('libmp3lame');
    expect(result.file.name).toBe('raro.mp3');
  });

  it('un audio grande va directo a la recompresión (no se intenta copiar)', async () => {
    const { prepareMediaForUpload } = await load();
    execMock.mockResolvedValue(0);
    readFileMock.mockResolvedValue(new Uint8Array(12 * MB));

    const audio = new File(['x'], 'podcast.wav', { type: 'audio/wav' });
    Object.defineProperty(audio, 'size', { value: 200 * MB });
    const result = await prepareMediaForUpload(audio, { skipExtractBelowBytes: THRESHOLD });

    expect(execMock).toHaveBeenCalledOnce();
    expect(execMock.mock.calls[0]![0]).toContain('libmp3lame');
    expect(result.file.name).toBe('podcast.mp3');
  });
});
