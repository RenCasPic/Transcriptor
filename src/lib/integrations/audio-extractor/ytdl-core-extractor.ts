import type { Readable } from 'node:stream';
import type { AudioExtractor, ExtractAudioOptions, ExtractedAudio } from './types';
import { consoleExtractionLogger, type ExtractionLogger } from './extraction-logger';

const INFO_TIMEOUT_MS = 20_000;
// Sonda breve para comprobar que la URL firmada del CDN de YouTube responde
// (y no un 403) ANTES de devolver el stream al pipeline de transcripción.
const PROBE_TIMEOUT_MS = 10_000;

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const AUDIO_MIME_PREFIX_TO_FORMAT: Array<{ prefix: string; extension: string; mimeType: string }> = [
  { prefix: 'audio/webm', extension: 'webm', mimeType: 'audio/webm' },
  { prefix: 'audio/mp4', extension: 'm4a', mimeType: 'audio/mp4' },
];

/**
 * Secuencia de intentos (máx. 3) variando los `player_client` de YouTube que
 * `@distube/ytdl-core` soporta de forma nativa (`WEB_EMBEDDED | TV | IOS |
 * ANDROID | WEB`). `getInfo()` ya prueba varios clientes en paralelo por
 * defecto; esta secuencia añade combinaciones alternativas y un último
 * recurso con el cliente `WEB` puro, que `getInfo()` excluye del set por
 * defecto. NO resuelve el problema de fondo (esta versión de la librería no
 * envía PO Token), pero recupera algunos vídeos que fallan con una sola
 * configuración.
 *
 * `mweb` / `web_creator` NO son valores válidos aquí: son de `yt-dlp`, no de
 * esta librería.
 */
const EXTRACTION_STRATEGIES: Array<{ name: string; playerClients: string[] }> = [
  { name: 'default-audio', playerClients: ['WEB_EMBEDDED', 'IOS', 'ANDROID', 'TV'] },
  { name: 'mobile-clients', playerClients: ['ANDROID', 'IOS'] },
  { name: 'web-fallback', playerClients: ['WEB'] },
];

// Códigos de estado del vídeo en sí: reintentar con otro cliente daría
// exactamente el mismo resultado, así que se propagan de inmediato.
const NON_RETRYABLE_CODES = new Set([
  'YOUTUBE_PRIVATE_VIDEO',
  'YOUTUBE_MEMBERS_ONLY',
  'YOUTUBE_AGE_RESTRICTED',
  'YOUTUBE_VIDEO_NOT_FOUND',
  'YOUTUBE_REGION_BLOCKED',
  'YOUTUBE_LIVE_UNSUPPORTED',
  'YOUTUBE_AUDIO_TOO_LONG',
  'YOUTUBE_AUDIO_FORMAT_UNSUPPORTED',
]);

// Cuando la librería no logra parsear el reproductor de YouTube (el tipo de
// rotura que nos ocupa), por defecto escribe un archivo de depuración
// (`<timestamp>-player-script.js`) en el directorio de trabajo del proceso
// (ver `saveDebugFile` en su propio código). No queremos ese archivo
// huérfano en disco en cada fallo; la librería respeta esta variable para
// desactivarlo. Se fija aquí (no en .env) para que la protección no dependa
// de que alguien la configure en cada entorno.
if (process.env.YTDL_NO_DEBUG_FILE === undefined) {
  process.env.YTDL_NO_DEBUG_FILE = '1';
}

/**
 * Extrae el audio de un vídeo de YouTube usando `@distube/ytdl-core`.
 *
 * NOTA (2025): el repositorio `distubejs/ytdl-core` fue archivado el
 * 2025-08-16 y ya no recibe mantenimiento — `4.16.12` es la versión final, no
 * habrá parches para futuros cambios del reproductor de YouTube. Sigue siendo
 * una librería NO oficial que replica lo que hace el reproductor web: funciona
 * mientras YouTube no cambie el esquema de sus URLs firmadas y no exija PO
 * Token, y deja de funcionar (sin aviso) cuando lo hace.
 *
 * Este extractor implementa:
 *  - una secuencia de reintentos con `player_client`s alternativos
 *    (`EXTRACTION_STRATEGIES`),
 *  - una sonda del CDN para distinguir "el extractor fue rechazado"
 *    (`YOUTUBE_EXTRACTOR_BLOCKED`, 403) de "la librería no sabe leer el
 *    reproductor actual" (`YOUTUBE_EXTRACTOR_INCOMPATIBLE`),
 *  - logging estructurado por intento (sin datos sensibles, ver
 *    `extraction-logger.ts`).
 *
 * Arreglo duradero (fuera del alcance de este archivo): migrar a
 * `youtubei.js` + generación de PO Token, o mover la extracción a un worker
 * con `yt-dlp` + un proveedor de PO Token. Mientras tanto, "Subir archivo" es
 * el camino fiable.
 */
export class YtdlCoreAudioExtractor implements AudioExtractor {
  async extract(videoUrl: string, options: ExtractAudioOptions = {}): Promise<ExtractedAudio> {
    // Import dinámico: si se cargara al evaluar este módulo, Next.js también
    // lo metería en el bundle "action-browser" que arma la referencia
    // cliente de las Server Actions — el mismo problema que rompió la
    // página del editor con isomorphic-dompurify.
    const ytdl = options.deps?.ytdl ?? (await import('@distube/ytdl-core')).default;
    const doFetch = options.deps?.fetch ?? fetch;
    const logger: ExtractionLogger = options.deps?.logger ?? consoleExtractionLogger;
    const extractorVersion: string = ytdl?.version ?? 'unknown';
    const videoId = extractVideoIdForLog(videoUrl);

    const startedAt = Date.now();
    const maxAttempts = EXTRACTION_STRATEGIES.length;
    let lastError: Error | null = null;
    let sawBlocked = false;
    let sawIncompatible: Error | null = null;

    for (const [i, strategy] of EXTRACTION_STRATEGIES.entries()) {
      const attemptNumber = i + 1;
      const attemptStartedAt = Date.now();

      try {
        const result = await this.attemptExtraction(ytdl, doFetch, videoUrl, strategy.playerClients, options);

        logger.attempt({
          videoId,
          extractorVersion,
          strategy: strategy.name,
          playerClients: strategy.playerClients,
          requestedFormat: result.requestedFormat,
          attempt: attemptNumber,
          maxAttempts,
          outcome: 'success',
          durationMs: Date.now() - attemptStartedAt,
        });
        logger.summary({
          videoId,
          extractorVersion,
          outcome: 'success',
          attempts: attemptNumber,
          totalDurationMs: Date.now() - startedAt,
          winningStrategy: strategy.name,
        });

        return result.audio;
      } catch (rawError) {
        const mapped = mapYtdlError(rawError);
        const code = errorCodeOf(mapped);

        logger.attempt({
          videoId,
          extractorVersion,
          strategy: strategy.name,
          playerClients: strategy.playerClients,
          requestedFormat: 'audioonly',
          attempt: attemptNumber,
          maxAttempts,
          outcome: 'failure',
          durationMs: Date.now() - attemptStartedAt,
          errorCode: code,
        });

        // Estado del vídeo (privado, eliminado, en vivo, demasiado largo…):
        // no tiene sentido probar otro cliente.
        if (NON_RETRYABLE_CODES.has(code)) {
          logger.summary({
            videoId,
            extractorVersion,
            outcome: 'failure',
            attempts: attemptNumber,
            totalDurationMs: Date.now() - startedAt,
            errorCode: code,
          });
          throw mapped;
        }

        lastError = mapped;
        if (code === 'YOUTUBE_EXTRACTOR_BLOCKED') sawBlocked = true;
        if (code === 'YOUTUBE_EXTRACTOR_INCOMPATIBLE') sawIncompatible = mapped;
      }
    }

    // Se agotaron los intentos. Se prioriza el diagnóstico más accionable:
    // "YouTube rechazó al extractor" (403) por encima de "la librería no sabe
    // leer el reproductor", y ese por encima de un fallo genérico.
    const finalError = sawBlocked
      ? new Error('YOUTUBE_EXTRACTOR_BLOCKED')
      : (sawIncompatible ?? lastError ?? new Error('YOUTUBE_EXTRACTOR_INCOMPATIBLE:no resolved audio format URL'));

    logger.summary({
      videoId,
      extractorVersion,
      outcome: 'failure',
      attempts: maxAttempts,
      totalDurationMs: Date.now() - startedAt,
      errorCode: errorCodeOf(finalError),
    });

    throw finalError;
  }

  /** Un único intento con un set concreto de `player_client`s. */
  private async attemptExtraction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ytdl: any,
    doFetch: typeof fetch,
    videoUrl: string,
    playerClients: string[],
    options: ExtractAudioOptions,
  ): Promise<{ audio: ExtractedAudio; requestedFormat: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info: any = await withTimeout<any>(
      ytdl.getInfo(videoUrl, {
        playerClients,
        requestOptions: { headers: { 'user-agent': BROWSER_USER_AGENT } },
      }),
      INFO_TIMEOUT_MS,
      'YOUTUBE_AUDIO_EXTRACTION_TIMEOUT',
    );

    const details = info.videoDetails;
    if (details.isPrivate) throw new Error('YOUTUBE_PRIVATE_VIDEO');
    if (details.isLiveContent) throw new Error('YOUTUBE_LIVE_UNSUPPORTED');

    const durationSeconds = Number(details.lengthSeconds) || 0;
    if (options.maxDurationSeconds && durationSeconds > options.maxDurationSeconds) {
      throw new Error('YOUTUBE_AUDIO_TOO_LONG');
    }

    const audioOnlyFormats = ytdl.filterFormats(info.formats, 'audioonly');
    if (audioOnlyFormats.length === 0) {
      // El vídeo en sí no tiene ningún track de solo-audio: es una
      // limitación real de ese contenido, no un problema del extractor.
      throw new Error('YOUTUBE_AUDIO_FORMAT_UNSUPPORTED');
    }

    // getInfo() ya intentó descifrar las firmas de cada formato. Si el
    // esquema de YouTube cambió y la librería todavía no lo sabe descifrar,
    // los formatos existen como objetos pero ninguno trae una `url`
    // resuelta — es la firma de una incompatibilidad del extractor con el
    // reproductor actual, distinta de que el vídeo no tenga pista de audio.
    const resolvedFormats = audioOnlyFormats
      .filter((format: { url?: string }) => !!format.url)
      .sort(
        (a: { audioBitrate?: number }, b: { audioBitrate?: number }) =>
          (a.audioBitrate ?? Infinity) - (b.audioBitrate ?? Infinity),
      );

    const format = resolvedFormats[0];
    if (!format) {
      throw new Error('YOUTUBE_EXTRACTOR_INCOMPATIBLE:no resolved audio format URL');
    }

    const mapped = AUDIO_MIME_PREFIX_TO_FORMAT.find((entry) => format.mimeType?.startsWith(entry.prefix));
    if (!mapped) {
      throw new Error('YOUTUBE_AUDIO_FORMAT_UNSUPPORTED');
    }

    // Sonda del CDN: un GET de rango mínimo. Si YouTube devuelve 403 aquí, el
    // stream que devolveríamos también fallaría — pero más tarde y lejos de
    // este módulo (dentro de `readStreamWithLimit`), con un mensaje genérico.
    // Detectarlo ahora permite (a) reintentar con otro `player_client` y
    // (b) devolver `YOUTUBE_EXTRACTOR_BLOCKED` en vez de "inténtalo más tarde".
    await probeFormatUrl(doFetch, format.url as string);

    const stream: Readable = ytdl.downloadFromInfo(info, { format });

    return {
      audio: {
        stream,
        fileExtension: mapped.extension,
        mimeType: mapped.mimeType,
        durationSeconds,
        title: details.title || 'Video de YouTube',
      },
      requestedFormat: `audioonly/${mapped.extension}`,
    };
  }
}

async function probeFormatUrl(doFetch: typeof fetch, url: string): Promise<void> {
  let response: Response;
  try {
    response = await withTimeout(
      doFetch(url, {
        method: 'GET',
        headers: { range: 'bytes=0-1', 'user-agent': BROWSER_USER_AGENT },
      }),
      PROBE_TIMEOUT_MS,
      'YOUTUBE_AUDIO_EXTRACTION_TIMEOUT',
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('YOUTUBE_')) throw error;
    // Fallo de red al sondear: transitorio, no una incompatibilidad.
    throw new Error(`YOUTUBE_AUDIO_EXTRACTION_FAILED:${error instanceof Error ? error.message : String(error)}`);
  }

  // Liberar el cuerpo para no dejar la conexión colgada.
  try {
    await response.body?.cancel();
  } catch {
    /* noop */
  }

  if (response.status === 403) {
    throw new Error('YOUTUBE_EXTRACTOR_BLOCKED');
  }
  // 200 (sin soporte de rango) y 206 (con soporte) son válidos.
  if (response.status !== 200 && response.status !== 206) {
    throw new Error(`YOUTUBE_AUDIO_EXTRACTION_FAILED:probe status ${response.status}`);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutErrorCode: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutErrorCode)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Devuelve el código interno de un Error ya mapeado (sin el `:detalle`). */
function errorCodeOf(error: Error): string {
  return error.message.split(':')[0] ?? error.message;
}

/**
 * Extrae el ID del vídeo de la URL SOLO para el logging. Nunca falla: si no
 * reconoce la forma, devuelve 'unknown' en vez de lanzar (el logging no debe
 * poder tumbar la extracción).
 */
function extractVideoIdForLog(videoUrl: string): string {
  try {
    const url = new URL(videoUrl);
    return url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop() || 'unknown';
  } catch {
    return 'unknown';
  }
}

// Fragmentos (en inglés, tal como los redacta la librería) que indican
// específicamente que el fallo es una incompatibilidad de descifrado entre
// @distube/ytdl-core y el reproductor actual de YouTube — no un vídeo
// privado/eliminado/con restricción de edad, no un timeout, no un error de
// Groq ni un bug propio. Ver tests/unit/ytdl-core-error-mapping.test.ts.
const EXTRACTOR_INCOMPATIBILITY_PATTERNS = ['decipher', 'n transform', 'playable format', 'signature'];

// Fragmentos que indican que YouTube RECHAZÓ la petición del extractor
// (típicamente un 403 al pedir el archivo de audio al CDN googlevideo.com),
// distinto de "la librería no sabe leer el reproductor".
const EXTRACTOR_BLOCKED_PATTERNS = ['status code: 403', 'statuscode=403', 'http error 403', '403 forbidden', 'forbidden'];

// Fragmentos de "este vídeo requiere ser miembro del canal".
const MEMBERS_ONLY_PATTERNS = ['members-only', 'members only', 'join this channel', "channel's members"];

/**
 * `@distube/ytdl-core` no expone errores tipados, solo mensajes en inglés
 * pensados para humanos. Este mapeo es un best-effort por coincidencia de
 * texto: puede dejar de funcionar si la librería cambia su redacción. Es la
 * misma fragilidad ya aceptada para el scraping de subtítulos.
 */
export function mapYtdlError(error: unknown): Error {
  if (error instanceof Error && error.message.startsWith('YOUTUBE_')) {
    return error;
  }
  const original = error instanceof Error ? error.message : String(error);
  const raw = original.toLowerCase();
  if (MEMBERS_ONLY_PATTERNS.some((pattern) => raw.includes(pattern))) {
    return new Error('YOUTUBE_MEMBERS_ONLY');
  }
  if (raw.includes('private')) return new Error('YOUTUBE_PRIVATE_VIDEO');
  if (raw.includes('sign in') || raw.includes('age')) return new Error('YOUTUBE_AGE_RESTRICTED');
  if (
    raw.includes('unavailable') ||
    raw.includes('removed') ||
    raw.includes('no video id found') ||
    raw.includes('no longer available')
  ) {
    return new Error('YOUTUBE_VIDEO_NOT_FOUND');
  }
  if (raw.includes('region') || raw.includes('country')) return new Error('YOUTUBE_REGION_BLOCKED');
  if (EXTRACTOR_BLOCKED_PATTERNS.some((pattern) => raw.includes(pattern))) {
    return new Error('YOUTUBE_EXTRACTOR_BLOCKED');
  }
  if (EXTRACTOR_INCOMPATIBILITY_PATTERNS.some((pattern) => raw.includes(pattern))) {
    return new Error(`YOUTUBE_EXTRACTOR_INCOMPATIBLE:${original}`);
  }
  // Sin coincidencia conocida (p. ej. un error de red genuinamente
  // transitorio): se conserva el mensaje original para diagnosticar sin
  // acceso a los logs del servidor, pero SIN clasificarlo como
  // incompatibilidad del extractor — ver translateAudioFallbackError.
  return new Error(`YOUTUBE_AUDIO_EXTRACTION_FAILED:${original}`);
}
