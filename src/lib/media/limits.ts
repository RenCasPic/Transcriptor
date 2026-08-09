/**
 * Límite duro de tamaño de archivo compartido por todos los flujos de
 * transcripción (subida manual, descarga por URL directa, audio extraído de
 * YouTube): 25 MB, el mismo límite que imponen las APIs de Whisper/Groq.
 */
export const MAX_MEDIA_BYTES = 26_214_400;
