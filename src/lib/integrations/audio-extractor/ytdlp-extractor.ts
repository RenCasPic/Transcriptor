import { spawn as nodeSpawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import type { AudioExtractor, ExtractAudioOptions, ExtractedAudio } from './types';
import { consoleExtractionLogger, type ExtractionLogger } from './extraction-logger';
import { resolveYtDlpBinary } from './ytdlp-binary';

const METADATA_TIMEOUT_MS = 25_000;
const STDERR_MAX_CHARS = 4_000;

// Selector de formato: audio en m4a preferido (contenedor que Whisper/Groq
// aceptan sin problema), luego webm/opus, luego cualquier audio. yt-dlp
// resuelve internamente qué cliente de YouTube usar para obtener una URL
// descargable — ahí está su ventaja sobre las librerías JS.
const AUDIO_FORMAT_SELECTOR = 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/ba/bestaudio*';

interface AudioKind {
  mimeType: string;
  fileExtension: string;
}

const DEFAULT_AUDIO_KIND: AudioKind = { mimeType: 'audio/mpeg', fileExtension: 'mp3' };

const EXT_TO_MIME: Record<string, AudioKind> = {
  m4a: { mimeType: 'audio/mp4', fileExtension: 'm4a' },
  mp4: { mimeType: 'audio/mp4', fileExtension: 'm4a' },
  webm: { mimeType: 'audio/webm', fileExtension: 'webm' },
  opus: { mimeType: 'audio/ogg', fileExtension: 'ogg' },
  ogg: { mimeType: 'audio/ogg', fileExtension: 'ogg' },
  mp3: DEFAULT_AUDIO_KIND,
  mpga: DEFAULT_AUDIO_KIND,
};

/**
 * Extrae el audio de un vídeo de YouTube invocando el binario `yt-dlp`.
 *
 * Por qué yt-dlp y no una librería JS: a fecha de 2026, YouTube entrega el
 * audio solo por SABR (streaming ABR del lado servidor sobre el protocolo
 * UMP). `@distube/ytdl-core` y `youtubei.js` esperan una URL de formato
 * normal/cifrada — ese modelo ya no existe para descargas, y un PO Token no
 * lo arregla. yt-dlp implementa SABR + una decena de clientes de fallback y
 * se parchea cada 1-2 semanas. Verificado empíricamente: yt-dlp baja audio
 * desde una IP de datacenter sin PO Token ni cookies; las librerías JP puras
 * devuelven "solo SABR, sin URL".
 *
 * El binario lo instala `scripts/setup-ytdlp.mjs` en `bin/` (postinstall /
 * prebuild) y viaja en el bundle de Vercel vía `outputFileTracingIncludes`.
 * Si YouTube rompe la extracción, sube `YTDLP_VERSION` a la última release.
 *
 * El audio NUNCA se guarda en disco: yt-dlp escribe a stdout (`-o -`) y ese
 * stream va directo a `readStreamWithLimit` -> proveedor de transcripción.
 */
export class YtDlpAudioExtractor implements AudioExtractor {
  async extract(videoUrl: string, options: ExtractAudioOptions = {}): Promise<ExtractedAudio> {
    const spawn = options.deps?.spawn ?? nodeSpawn;
    const logger: ExtractionLogger = options.deps?.logger ?? consoleExtractionLogger;
    const videoId = extractVideoIdForLog(videoUrl);
    const startedAt = Date.now();

    const binary =
      options.deps && 'binaryPath' in options.deps ? options.deps.binaryPath : await resolveYtDlpBinary();
    if (!binary) {
      logger.summary({
        videoId,
        extractorVersion: 'unavailable',
        outcome: 'failure',
        attempts: 0,
        totalDurationMs: 0,
        errorCode: 'AUDIO_EXTRACTOR_UNAVAILABLE',
      });
      throw new Error('AUDIO_EXTRACTOR_UNAVAILABLE');
    }

    const extractorVersion = options.deps?.ytdlpVersion ?? (await readVersion(spawn, binary));

    let meta: YtDlpMetadata;
    try {
      meta = await this.probeMetadata(spawn, binary, videoUrl);
    } catch (error) {
      const mapped = toError(error);
      logger.attempt({
        videoId,
        extractorVersion,
        strategy: 'yt-dlp/metadata',
        playerClients: [],
        requestedFormat: AUDIO_FORMAT_SELECTOR,
        attempt: 1,
        maxAttempts: 1,
        outcome: 'failure',
        durationMs: Date.now() - startedAt,
        errorCode: errorCodeOf(mapped),
      });
      logger.summary({
        videoId,
        extractorVersion,
        outcome: 'failure',
        attempts: 1,
        totalDurationMs: Date.now() - startedAt,
        errorCode: errorCodeOf(mapped),
      });
      throw mapped;
    }

    if (meta.isLive) throw hardError('YOUTUBE_LIVE_UNSUPPORTED', logger, videoId, extractorVersion, startedAt);
    if (meta.availabilityCode) {
      throw hardError(meta.availabilityCode, logger, videoId, extractorVersion, startedAt);
    }
    if (options.maxDurationSeconds && meta.durationSeconds > options.maxDurationSeconds) {
      throw hardError('YOUTUBE_AUDIO_TOO_LONG', logger, videoId, extractorVersion, startedAt);
    }

    const { mimeType, fileExtension } = EXT_TO_MIME[meta.ext ?? ''] ?? DEFAULT_AUDIO_KIND;

    // Descarga real: yt-dlp -> stdout -> PassThrough. El PassThrough permite
    // propagar como 'error' del stream cualquier fallo que yt-dlp reporte
    // DESPUÉS de haber empezado a emitir bytes (p. ej. un 403 a mitad).
    const format = meta.formatId ?? AUDIO_FORMAT_SELECTOR;
    const child = spawn(
      binary,
      ['--no-warnings', '--no-progress', '--no-playlist', '--no-part', '-f', format, '-o', '-', videoUrl],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    const out = new PassThrough();
    let stderr = '';
    child.stderr?.on('data', (d: Buffer) => {
      if (stderr.length < STDERR_MAX_CHARS) stderr += d.toString();
    });
    // `{ end: false }`: NO cerramos el PassThrough cuando stdout termina, sino
    // solo tras conocer el exit code. Así, si yt-dlp emite algunos bytes y
    // luego falla (p. ej. un 403 a mitad), el consumidor recibe un 'error' y
    // no un 'end' con un audio truncado.
    child.stdout?.pipe(out, { end: false });
    child.on('error', (err: Error) => out.destroy(new Error(`YOUTUBE_AUDIO_EXTRACTION_FAILED:${err.message}`)));
    child.on('close', (code: number | null) => {
      if (code === 0) out.end();
      else out.destroy(mapYtDlpError(stderr, code));
    });
    // Si el consumidor corta el stream (límite de tamaño / timeout en
    // readStreamWithLimit), matamos yt-dlp para no dejar el proceso colgado.
    out.on('close', () => {
      if (!child.killed) child.kill('SIGKILL');
    });

    logger.attempt({
      videoId,
      extractorVersion,
      strategy: 'yt-dlp',
      playerClients: [],
      requestedFormat: meta.formatId ? `${meta.formatId} (${meta.ext})` : AUDIO_FORMAT_SELECTOR,
      attempt: 1,
      maxAttempts: 1,
      outcome: 'success',
      durationMs: Date.now() - startedAt,
    });
    logger.summary({
      videoId,
      extractorVersion,
      outcome: 'success',
      attempts: 1,
      totalDurationMs: Date.now() - startedAt,
      winningStrategy: 'yt-dlp',
    });

    return {
      stream: out,
      fileExtension,
      mimeType,
      durationSeconds: meta.durationSeconds,
      title: meta.title || 'Video de YouTube',
    };
  }

  private probeMetadata(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spawn: any,
    binary: string,
    videoUrl: string,
  ): Promise<YtDlpMetadata> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        binary,
        ['-J', '--no-warnings', '--no-playlist', '-f', AUDIO_FORMAT_SELECTOR, videoUrl],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('YOUTUBE_AUDIO_EXTRACTION_TIMEOUT'));
      }, METADATA_TIMEOUT_MS);

      child.stdout?.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr?.on('data', (d: Buffer) => {
        if (stderr.length < STDERR_MAX_CHARS) stderr += d.toString();
      });
      child.on('error', (err: Error) => {
        clearTimeout(timer);
        reject(new Error(`YOUTUBE_AUDIO_EXTRACTION_FAILED:${err.message}`));
      });
      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(mapYtDlpError(stderr, code));
          return;
        }
        try {
          resolve(parseMetadata(stdout));
        } catch {
          reject(new Error('YOUTUBE_EXTRACTOR_INCOMPATIBLE:could not parse yt-dlp metadata'));
        }
      });
    });
  }
}

interface YtDlpMetadata {
  title: string;
  durationSeconds: number;
  isLive: boolean;
  availabilityCode: string | null;
  formatId: string | null;
  ext: string | null;
}

function parseMetadata(raw: string): YtDlpMetadata {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = JSON.parse(raw);
  const chosen = Array.isArray(json.requested_downloads) ? json.requested_downloads[0] : undefined;
  const fallback = pickBestAudio(Array.isArray(json.formats) ? json.formats : []);
  const fmt = chosen ?? fallback;

  return {
    title: typeof json.title === 'string' ? json.title : '',
    durationSeconds: Number(json.duration) || 0,
    isLive: json.is_live === true || json.live_status === 'is_live' || json.live_status === 'is_upcoming',
    availabilityCode: availabilityToCode(json.availability),
    formatId: fmt?.format_id ? String(fmt.format_id) : null,
    ext: fmt?.ext ? String(fmt.ext) : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickBestAudio(formats: any[]): any {
  return formats
    .filter((f) => f && f.acodec && f.acodec !== 'none' && (f.vcodec === 'none' || f.vcodec == null))
    .sort((a, b) => (Number(b.abr) || Number(b.tbr) || 0) - (Number(a.abr) || Number(a.tbr) || 0))[0];
}

function availabilityToCode(availability: unknown): string | null {
  switch (availability) {
    case 'private':
      return 'YOUTUBE_PRIVATE_VIDEO';
    case 'premium_only':
    case 'subscriber_only':
      return 'YOUTUBE_MEMBERS_ONLY';
    case 'needs_auth':
      return 'YOUTUBE_AGE_RESTRICTED';
    default:
      return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readVersion(spawn: any, binary: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const child = spawn(binary, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] });
      let out = '';
      child.stdout?.on('data', (d: Buffer) => {
        out += d.toString();
      });
      child.on('error', () => resolve('unknown'));
      child.on('close', () => resolve(out.trim() || 'unknown'));
    } catch {
      resolve('unknown');
    }
  });
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function errorCodeOf(error: Error): string {
  return error.message.split(':')[0] ?? error.message;
}

function hardError(
  code: string,
  logger: ExtractionLogger,
  videoId: string,
  extractorVersion: string,
  startedAt: number,
): Error {
  logger.summary({
    videoId,
    extractorVersion,
    outcome: 'failure',
    attempts: 1,
    totalDurationMs: Date.now() - startedAt,
    errorCode: code,
  });
  return new Error(code);
}

function tail(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(-220);
}

/**
 * Traduce el stderr de yt-dlp a los mismos códigos internos que usa el
 * extractor de `@distube/ytdl-core`, para que `youtube-errors.ts` y
 * `youtube-import-error-presentation.ts` funcionen sin cambios.
 *
 * Best-effort por coincidencia de texto: yt-dlp puede cambiar su redacción.
 */
export function mapYtDlpError(stderr: string, exitCode: number | null): Error {
  const s = stderr.toLowerCase();

  if (/this live event|premieres in|premiere will begin|\bis live\b|live stream/.test(s)) {
    return new Error('YOUTUBE_LIVE_UNSUPPORTED');
  }
  if (/members-only|join this channel|available to this channel's members|members only content/.test(s)) {
    return new Error('YOUTUBE_MEMBERS_ONLY');
  }
  if (/private video/.test(s)) {
    return new Error('YOUTUBE_PRIVATE_VIDEO');
  }
  if (/confirm your age|age-restricted|inappropriate for some users|age verification/.test(s)) {
    return new Error('YOUTUBE_AGE_RESTRICTED');
  }
  if (/not a bot|sign in to confirm|use --cookies|cookies-from-browser/.test(s)) {
    // "Sign in to confirm you're not a bot" — YouTube bloqueó la IP del
    // servidor. Mismo trato que un 403: el extractor fue rechazado.
    return new Error('YOUTUBE_EXTRACTOR_BLOCKED');
  }
  if (/http error 403|http error 429|\bforbidden\b|too many requests/.test(s)) {
    return new Error('YOUTUBE_EXTRACTOR_BLOCKED');
  }
  if (
    /video unavailable|has been removed|no longer available|does not exist|this video is unavailable|incomplete youtube id|unable to download webpage: http error 404|is not a valid url/.test(
      s,
    )
  ) {
    return new Error('YOUTUBE_VIDEO_NOT_FOUND');
  }
  if (/not made this video available in your country|not available in your country|blocked it in your country|contains content from|geo-restricted/.test(s)) {
    return new Error('YOUTUBE_REGION_BLOCKED');
  }
  if (/requested format is not available|requested format not available/.test(s)) {
    return new Error('YOUTUBE_AUDIO_FORMAT_UNSUPPORTED');
  }
  if (
    /unable to extract|nsig extraction failed|failed to extract any player response|unable to recognize|player response|some formats may be missing|only images are available/.test(
      s,
    )
  ) {
    return new Error(`YOUTUBE_EXTRACTOR_INCOMPATIBLE:${tail(stderr) || `exit ${exitCode}`}`);
  }
  return new Error(`YOUTUBE_AUDIO_EXTRACTION_FAILED:${tail(stderr) || `yt-dlp exit ${exitCode}`}`);
}

/** Solo para el logging. Nunca lanza. */
function extractVideoIdForLog(videoUrl: string): string {
  try {
    const url = new URL(videoUrl);
    return url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop() || 'unknown';
  } catch {
    return 'unknown';
  }
}
