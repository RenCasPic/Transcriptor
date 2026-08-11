'use client';

import { useRef, useState } from 'react';
import {
  importYoutubeVideoAction,
  transcribeYoutubeAudioAction,
  type ImportYoutubeVideoResult,
} from '@/lib/actions/youtube';
import type { ActionResult } from '@/lib/types/domain';

export type YoutubeImportStage =
  | 'idle'
  | 'fetching_captions'
  | 'no_captions_found'
  | 'extracting_audio'
  | 'transcribing_audio'
  | 'done'
  | 'error';

interface RunParams {
  projectId: string;
  videoUrl: string;
  language: string;
}

// Tiempo estimado antes de pasar del mensaje "extrayendo audio" a
// "transcribiendo audio": ambos pasos ocurren dentro de una sola llamada al
// servidor (transcribeYoutubeAudioAction) para no tener que subir el audio
// extraído de vuelta al cliente entre dos peticiones, así que este cambio de
// mensaje es una estimación de tiempo y no un evento real confirmado por el
// servidor. Se documenta explícitamente para que quede claro que no es
// progreso real medido, solo para que la espera no se sienta congelada.
const EXTRACTING_TO_TRANSCRIBING_DELAY_MS = 4000;

/**
 * Orquesta el import de YouTube en el cliente: intenta subtítulos primero y,
 * si el servidor indica que hace falta, encadena la transcripción por audio
 * (Groq), exponiendo una etapa (`stage`) para que la UI nunca se vea
 * congelada durante la espera.
 */
export function useYoutubeImport() {
  const [stage, setStage] = useState<YoutubeImportStage>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const cosmeticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function run({
    projectId,
    videoUrl,
    language,
  }: RunParams): Promise<ActionResult<{ transcriptId: string; title: string }>> {
    // Reinicia cualquier estado que haya quedado de un intento anterior
    // (etapa, timer cosmético) para que un nuevo intento arranque limpio,
    // sin importar cómo haya terminado el anterior.
    if (cosmeticTimerRef.current) {
      clearTimeout(cosmeticTimerRef.current);
      cosmeticTimerRef.current = null;
    }
    setIsRunning(true);
    setStage('fetching_captions');

    try {
      const first = await importYoutubeVideoAction({ projectId, videoUrl, language });
      if (!first.success) {
        setStage('error');
        return first;
      }

      const data: ImportYoutubeVideoResult = first.data;
      if (data.status === 'completed') {
        setStage('done');
        return ok(data.transcriptId, data.title);
      }

      setStage('no_captions_found');
      setStage('extracting_audio');
      cosmeticTimerRef.current = setTimeout(() => setStage('transcribing_audio'), EXTRACTING_TO_TRANSCRIBING_DELAY_MS);

      const second = await transcribeYoutubeAudioAction({
        projectId,
        sourceId: data.sourceId,
        jobId: data.jobId,
        videoId: data.videoId,
        language,
      });

      if (!second.success) {
        setStage('error');
        return second;
      }

      setStage('done');
      return ok(second.data.transcriptId, second.data.title);
    } catch (error) {
      // Defensivo: una Server Action no debería lanzar (ambas envuelven
      // todo en try/catch y devuelven `{success: false}`), pero si algo
      // inesperado revienta antes de eso (p. ej. un fallo de red llamando a
      // la acción), esto evita que quede sin mostrar ningún error.
      setStage('error');
      const message = error instanceof Error ? error.message : 'YOUTUBE_IMPORT_UNEXPECTED_ERROR';
      return { success: false, error: { code: 'YOUTUBE_IMPORT_UNEXPECTED_ERROR', message } };
    } finally {
      if (cosmeticTimerRef.current) {
        clearTimeout(cosmeticTimerRef.current);
        cosmeticTimerRef.current = null;
      }
      setIsRunning(false);
    }
  }

  return { stage, isRunning, run };
}

function ok(transcriptId: string, title: string): ActionResult<{ transcriptId: string; title: string }> {
  return { success: true, data: { transcriptId, title } };
}
