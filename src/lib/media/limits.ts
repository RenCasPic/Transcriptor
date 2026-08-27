/**
 * Configuración de límites de medios (audio/video). Todo lo que antes era el
 * único `MAX_MEDIA_BYTES` (25 MB hardcodeado) vive ahora aquí y es
 * configurable por variable de entorno, con defaults razonables para que el
 * desarrollo local funcione sin configurar nada.
 *
 * Distinción clave:
 * - `maxUploadBytes`: lo que un usuario puede SUBIR a Storage. Puede ser muy
 *   grande (cientos de MB) porque el archivo va directo del navegador a
 *   Supabase Storage (signed upload URL), nunca a través de una Server Action.
 * - `providerRequestMaxBytes`: el límite duro POR PETICIÓN de las APIs de
 *   transcripción (Whisper/Groq = 25 MB). Cuando el audio lo supera, el
 *   procesador lo trocea en chunks (ver `audio-chunker/`). Este límite lo
 *   declara cada proveedor (`TranscriptionProvider.limits`), no se asume aquí.
 * - `chunk*`: parámetros de troceado, usados solo cuando hay que chunkear.
 */

const MB = 1024 * 1024;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export interface MediaLimits {
  /** Tamaño máximo (bytes) del archivo QUE SE SUBE a Storage (tras extraer audio en el navegador). */
  maxUploadBytes: number;
  /**
   * Tamaño máximo (bytes) del archivo que el usuario puede SELECCIONAR (antes de
   * extraer el audio en el navegador). Un video de 50 min puede pesar cientos de
   * MB; solo se sube el audio comprimido resultante, que sí cabe en `maxUploadBytes`.
   */
  maxSourceBytes: number;
  /**
   * Si el archivo elegido es AUDIO y pesa menos que esto, se sube tal cual sin
   * pasar por la extracción con ffmpeg.wasm (camino simple para archivos chicos).
   */
  clientExtractThresholdBytes: number;
  /** Duración máxima (segundos) aceptada para procesar. Evita procesar streams de horas. */
  maxDurationSeconds: number;
  /** Tamaño objetivo (bytes) de cada chunk de audio al trocear. */
  chunkTargetBytes: number;
  /** Duración máxima (segundos) de cada chunk de audio al trocear. */
  chunkMaxSeconds: number;
  /** Bitrate (kbps) del audio mono re-codificado al trocear (voz: 64 kbps sobra). */
  chunkAudioBitrateKbps: number;
}

/**
 * Lee la configuración de límites en tiempo de llamada (no al importar el
 * módulo) para que los tests puedan sobrescribir el entorno con `vi.stubEnv`.
 */
export function getMediaLimits(): MediaLimits {
  return {
    maxUploadBytes: envInt('MEDIA_MAX_UPLOAD_MB', 500) * MB,
    maxSourceBytes: envInt('MEDIA_MAX_SOURCE_MB', 2000) * MB,
    clientExtractThresholdBytes: envInt('MEDIA_CLIENT_EXTRACT_THRESHOLD_MB', 15) * MB,
    maxDurationSeconds: envInt('MEDIA_MAX_DURATION_SECONDS', 6 * 60 * 60),
    chunkTargetBytes: envInt('MEDIA_CHUNK_TARGET_MB', 20) * MB,
    chunkMaxSeconds: envInt('MEDIA_CHUNK_MAX_SECONDS', 600),
    chunkAudioBitrateKbps: envInt('MEDIA_CHUNK_AUDIO_BITRATE_KBPS', 64),
  };
}

/**
 * Límite duro POR PETICIÓN de las APIs de transcripción tipo Whisper/OpenAI y
 * Groq (25 MB). Es una constante del servicio, no configurable: si cambia,
 * cambia en el proveedor correspondiente. Se sigue exportando como
 * `MAX_MEDIA_BYTES` por compatibilidad con el código que ya lo importaba
 * (descarga de audio de YouTube, que no trocea).
 */
export const PROVIDER_REQUEST_MAX_BYTES = 25 * MB;

/** @deprecated Usa `PROVIDER_REQUEST_MAX_BYTES` o `getMediaLimits()` según el caso. */
export const MAX_MEDIA_BYTES = PROVIDER_REQUEST_MAX_BYTES;
