'use client';

import { useCallback, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  createMediaUploadUrlAction,
  enqueueMediaTranscriptionAction,
} from '@/lib/actions/transcription';
import { validateMediaUpload, mediaFormatForExtension, extensionOf } from '@/lib/media/formats';
import { prepareMediaForUpload } from '@/lib/media/extract-audio-client';
import type { ActionResult } from '@/lib/types/domain';

export type UploadPhase =
  | 'idle'
  | 'preparing'
  | 'loading_converter'
  | 'extracting'
  | 'uploading'
  | 'enqueuing'
  | 'done'
  | 'error';

interface StartParams {
  projectId: string;
  file: File;
  language: string;
  /** Tamaño máx. del archivo QUE SE SUBE (tras extraer audio). */
  maxUploadBytes: number;
  /** Tamaño máx. del archivo que el usuario puede elegir (antes de extraer). */
  maxSourceBytes: number;
  /** Audio por debajo de esto se sube sin pasar por ffmpeg.wasm. */
  clientExtractThresholdBytes: number;
  autoGenerate?: boolean;
}

/**
 * Prepara y sube un archivo de medios:
 * 1. Si es video o audio grande, extrae el audio EN EL NAVEGADOR (ffmpeg.wasm)
 *    a un MP3 compacto — así un podcast de 50 min entra en el límite de Storage.
 * 2. Sube ese archivo DIRECTO a Supabase Storage (signed upload URL) con
 *    progreso. Ningún byte pasa por una Server Action.
 * 3. Encola la transcripción.
 */
export function useMediaUpload() {
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setProgress(0);
  }, []);

  const cancel = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    reset();
  }, [reset]);

  const start = useCallback(
    async ({
      projectId,
      file,
      language,
      maxUploadBytes,
      maxSourceBytes,
      clientExtractThresholdBytes,
      autoGenerate = true,
    }: StartParams): Promise<ActionResult<{ jobId: string }>> => {
      setProgress(0);
      setPhase('preparing');

      const fail = (code: string): ActionResult<{ jobId: string }> => {
        setPhase('error');
        return { success: false, error: { code, message: code } };
      };

      // Formato: se valida el archivo ORIGINAL (extensión soportada).
      const ext = extensionOf(file.name);
      if (!mediaFormatForExtension(ext)) return fail('UNSUPPORTED_MEDIA_FORMAT');
      if (!Number.isFinite(file.size) || file.size <= 0) return fail('INVALID_MEDIA_FILE');
      if (file.size > maxSourceBytes) return fail('MEDIA_SOURCE_TOO_LARGE');

      // Extracción de audio en el navegador (si hace falta).
      const abort = new AbortController();
      abortRef.current = abort;
      let uploadFile = file;
      try {
        const prepared = await prepareMediaForUpload(file, {
          skipExtractBelowBytes: clientExtractThresholdBytes,
          onStage: (stage) => setPhase(stage === 'loading' ? 'loading_converter' : 'extracting'),
          onProgress: (pct) => setProgress(pct),
          signal: abort.signal,
        });
        uploadFile = prepared.file;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AUDIO_EXTRACTION_CLIENT_FAILED';
        if (message === 'ABORTED') return fail('ABORTED');
        // ffmpeg.wasm no disponible o falló: si el original ya cabe, se sube tal
        // cual; si no, no hay forma de subirlo.
        if (file.size <= maxUploadBytes) {
          uploadFile = file;
        } else {
          return fail('AUDIO_EXTRACTION_CLIENT_FAILED');
        }
      } finally {
        abortRef.current = null;
      }

      const localCheck = validateMediaUpload({
        filename: uploadFile.name,
        contentType: uploadFile.type || null,
        sizeBytes: uploadFile.size,
        maxUploadBytes,
      });
      if (!localCheck.ok) return fail(localCheck.code);

      setProgress(0);
      setPhase('preparing');
      const target = await createMediaUploadUrlAction({
        projectId,
        filename: uploadFile.name,
        contentType: uploadFile.type || null,
        sizeBytes: uploadFile.size,
      });
      if (!target.success) {
        setPhase('error');
        return target;
      }

      setPhase('uploading');
      try {
        try {
          await putWithProgress(target.data.uploadUrl, uploadFile, (pct) => setProgress(pct), (xhr) => {
            xhrRef.current = xhr;
          });
        } catch (putError) {
          // 413 = Storage rechazó por tamaño (límite global del proyecto Supabase).
          // Reintentar con el SDK daría el mismo 413.
          if (putError instanceof Error && putError.message === 'UPLOAD_HTTP_413') {
            return fail('MEDIA_FILE_TOO_LARGE');
          }
          // Otro fallo (CORS, red): reintento con el SDK (sin barra de progreso).
          const supabase = createClient();
          const { error } = await supabase.storage
            .from(target.data.bucket)
            .uploadToSignedUrl(target.data.path, target.data.token, uploadFile, {
              contentType: uploadFile.type || 'application/octet-stream',
            });
          if (error) {
            const tooLarge = /exceeded|too large|maximum allowed size/i.test(error.message);
            return fail(tooLarge ? 'MEDIA_FILE_TOO_LARGE' : 'MEDIA_UPLOAD_FAILED');
          }
          setProgress(100);
        }
      } finally {
        xhrRef.current = null;
      }

      setPhase('enqueuing');
      const enqueued = await enqueueMediaTranscriptionAction({
        projectId,
        storagePath: target.data.path,
        originalFilename: uploadFile.name,
        contentType: uploadFile.type || null,
        language,
        autoGenerate,
      });
      if (!enqueued.success) {
        setPhase('error');
        return enqueued;
      }

      setPhase('done');
      return { success: true, data: { jobId: enqueued.data.jobId } };
    },
    [],
  );

  return { phase, progress, start, cancel, reset };
}

function putWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
  registerXhr: (xhr: XMLHttpRequest) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    registerXhr(xhr);
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`UPLOAD_HTTP_${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('UPLOAD_NETWORK_ERROR'));
    xhr.onabort = () => reject(new Error('UPLOAD_ABORTED'));
    xhr.send(file);
  });
}
