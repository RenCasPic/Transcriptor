import type { Readable } from 'node:stream';

/**
 * Consume un stream de Node hasta el final y lo junta en un solo Buffer, con
 * dos protecciones necesarias porque el stream viene de una fuente externa
 * no confiable (audio de YouTube vía @distube/ytdl-core):
 *
 * - Corta la descarga en cuanto se supera `maxBytes`, en vez de esperar a
 *   tenerlo todo en memoria para recién ahí rechazarlo (evita gastar tiempo y
 *   memoria en un archivo que de todas formas se va a descartar).
 * - Aborta si no termina dentro de `timeoutMs` (una conexión colgada no debe
 *   dejar la función esperando indefinidamente).
 *
 * En ambos casos se llama a `stream.destroy()` para liberar la conexión.
 */
export function readStreamWithLimit(stream: Readable, maxBytes: number, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    const timer = setTimeout(() => {
      settle(() => {
        stream.destroy();
        reject(new Error('YOUTUBE_AUDIO_DOWNLOAD_TIMEOUT'));
      });
    }, timeoutMs);

    function settle(fn: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    }

    stream.on('data', (chunk: Buffer) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        settle(() => {
          stream.destroy();
          reject(new Error('TRANSCRIPTION_FILE_TOO_LARGE'));
        });
        return;
      }
      chunks.push(chunk);
    });

    stream.on('end', () => {
      settle(() => resolve(Buffer.concat(chunks)));
    });

    stream.on('error', (error) => {
      settle(() => reject(error instanceof Error ? error : new Error('YOUTUBE_AUDIO_DOWNLOAD_FAILED')));
    });
  });
}
