import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { readStreamWithLimit } from '@/lib/media/read-stream-with-limit';

function readableFromChunks(chunks: Buffer[], options?: { errorAfter?: number }): Readable {
  let index = 0;
  return new Readable({
    read() {
      if (options?.errorAfter !== undefined && index === options.errorAfter) {
        this.destroy(new Error('boom'));
        return;
      }
      if (index >= chunks.length) {
        this.push(null);
        return;
      }
      this.push(chunks[index]);
      index += 1;
    },
  });
}

describe('readStreamWithLimit', () => {
  it('junta todos los chunks en un solo Buffer cuando no se supera el límite', async () => {
    const stream = readableFromChunks([Buffer.from('hola '), Buffer.from('mundo')]);
    const result = await readStreamWithLimit(stream, 1024, 1000);
    expect(result.toString('utf-8')).toBe('hola mundo');
  });

  it('rechaza con TRANSCRIPTION_FILE_TOO_LARGE al superar el límite de bytes', async () => {
    const stream = readableFromChunks([Buffer.alloc(10), Buffer.alloc(10)]);
    await expect(readStreamWithLimit(stream, 15, 1000)).rejects.toThrow('TRANSCRIPTION_FILE_TOO_LARGE');
  });

  it('destruye el stream al superar el límite de bytes', async () => {
    const stream = readableFromChunks([Buffer.alloc(10), Buffer.alloc(10)]);
    await expect(readStreamWithLimit(stream, 15, 1000)).rejects.toThrow();
    expect(stream.destroyed).toBe(true);
  });

  it('rechaza con YOUTUBE_AUDIO_DOWNLOAD_TIMEOUT si no termina a tiempo', async () => {
    const stream = new Readable({ read() {} }); // nunca empuja datos ni termina
    await expect(readStreamWithLimit(stream, 1024, 20)).rejects.toThrow('YOUTUBE_AUDIO_DOWNLOAD_TIMEOUT');
  });

  it('propaga el error del stream si ocurre uno', async () => {
    const stream = readableFromChunks([Buffer.from('a'), Buffer.from('b')], { errorAfter: 1 });
    await expect(readStreamWithLimit(stream, 1024, 1000)).rejects.toThrow('boom');
  });
});
