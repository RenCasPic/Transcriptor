/**
 * Logging estructurado (una línea JSON por evento) para la extracción de
 * audio de YouTube. Sin dependencias: escribe a stdout/stderr vía `console`,
 * que es lo que capturan Vercel y la mayoría de plataformas.
 *
 * SEGURIDAD: este logger solo acepta el struct tipado de abajo. Nunca recibe
 * —ni debe recibir— cookies, cabeceras, tokens, la URL firmada del CDN de
 * YouTube ni datos personales del usuario. `videoId` es el identificador
 * público del vídeo (no es un dato personal). Si en el futuro se añade un
 * campo, revisar que siga cumpliendo esto.
 */

export type ExtractionOutcome = 'success' | 'failure';

export interface ExtractionAttemptRecord {
  /** Identificador público del vídeo de YouTube (11 caracteres). */
  videoId: string;
  /** Versión del extractor activo en runtime (yt-dlp, o `@distube/ytdl-core`). */
  extractorVersion: string;
  /** Nombre de la estrategia/cliente probada en este intento. */
  strategy: string;
  /** `player_client`s de YouTube usados en este intento. */
  playerClients: string[];
  /** Formato solicitado (p. ej. "audioonly/m4a"). */
  requestedFormat: string;
  /** Nº de intento (1-indexado) y total de intentos planificados. */
  attempt: number;
  maxAttempts: number;
  outcome: ExtractionOutcome;
  /** Tiempo de ejecución del intento en milisegundos. */
  durationMs: number;
  /** Código de error interno cuando `outcome === 'failure'`. */
  errorCode?: string;
}

export interface ExtractionSummaryRecord {
  videoId: string;
  extractorVersion: string;
  outcome: ExtractionOutcome;
  attempts: number;
  totalDurationMs: number;
  /** Estrategia que funcionó (si `outcome === 'success'`). */
  winningStrategy?: string;
  /** Código de error final (si `outcome === 'failure'`). */
  errorCode?: string;
}

export interface ExtractionLogger {
  attempt(record: ExtractionAttemptRecord): void;
  summary(record: ExtractionSummaryRecord): void;
}

function emit(level: 'info' | 'error', event: string, payload: object): void {
  const line = JSON.stringify({ event, ts: new Date().toISOString(), ...payload });
  if (level === 'error') {
    console.error(line);
  } else {
    console.info(line);
  }
}

export const consoleExtractionLogger: ExtractionLogger = {
  attempt(record) {
    emit(record.outcome === 'failure' ? 'error' : 'info', 'youtube_audio_extraction_attempt', record);
  },
  summary(record) {
    emit(record.outcome === 'failure' ? 'error' : 'info', 'youtube_audio_extraction_result', record);
  },
};

/** Logger que descarta todo. Útil en tests que no quieren ruido en la consola. */
export const noopExtractionLogger: ExtractionLogger = {
  attempt() {},
  summary() {},
};
