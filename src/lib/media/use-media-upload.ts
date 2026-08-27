'use client';

import { useCallback, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  createMediaUploadUrlAction,
  enqueueMediaTranscriptionAction,
} from '@/lib/actions/transcription';
import { validateMediaUpload } from '@/lib/media/formats';
import type { ActionResult } from '@/lib/types/domain';

export type UploadPhase = 'idle' | 'preparing' | 'uploading' | 'enqueuing' | 'done' | 'error';

interface StartParams {
  projectId: string;
  file: File;
  language: string;
  /** Límite de subida (bytes), pasado desde un Server Component que sí lee la config. */
  maxUploadBytes: number;
  autoGenerate?: boolean;
}

/**
 * Sube un archivo de medios DIRECTAMENTE a Supabase Storage (signed upload
 * URL) midiendo el progreso, y luego encola su transcripción. Ningún byte del
 * archivo pasa por una Server Action: la acción solo recibe metadata.
 */
export function useMediaUpload() {
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setProgress(0);
  }, []);

  const cancel = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    reset();
  }, [reset]);

  const start = useCallback(
    async ({
      projectId,
      file,
      language,
      maxUploadBytes,
      autoGenerate = true,
    }: StartParams): Promise<ActionResult<{ jobId: string }>> => {
      setProgress(0);
      setPhase('preparing');

      const localCheck = validateMediaUpload({
        filename: file.name,
        contentType: file.type || null,
        sizeBytes: file.size,
        maxUploadBytes,
      });
      if (!localCheck.ok) {
        setPhase('error');
        return { success: false, error: { code: localCheck.code, message: localCheck.code } };
      }

      const target = await createMediaUploadUrlAction({
        projectId,
        filename: file.name,
        contentType: file.type || null,
        sizeBytes: file.size,
      });
      if (!target.success) {
        setPhase('error');
        return target;
      }

      setPhase('uploading');
      try {
        try {
          await putWithProgress(target.data.uploadUrl, file, (pct) => setProgress(pct), (xhr) => {
            xhrRef.current = xhr;
          });
        } catch (putError) {
          // 413 = Storage rechazó por tamaño (límite del bucket o, sobre todo,
          // el límite GLOBAL del proyecto Supabase — 50 MB en el plan gratuito).
          // Reintentar con el SDK daría el mismo 413, así que se corta aquí con
          // un mensaje claro.
          if (putError instanceof Error && putError.message === 'UPLOAD_HTTP_413') {
            setPhase('error');
            return { success: false, error: { code: 'MEDIA_FILE_TOO_LARGE', message: 'MEDIA_FILE_TOO_LARGE' } };
          }
          // Otro fallo (CORS, red, particularidad del entorno): reintento con el
          // SDK, que hace el upload por otra vía (sin barra de progreso).
          const supabase = createClient();
          const { error } = await supabase.storage
            .from(target.data.bucket)
            .uploadToSignedUrl(target.data.path, target.data.token, file, {
              contentType: file.type || 'application/octet-stream',
            });
          if (error) {
            setPhase('error');
            const tooLarge = /exceeded|too large|maximum allowed size/i.test(error.message);
            return {
              success: false,
              error: {
                code: tooLarge ? 'MEDIA_FILE_TOO_LARGE' : 'MEDIA_UPLOAD_FAILED',
                message: tooLarge ? 'MEDIA_FILE_TOO_LARGE' : 'MEDIA_UPLOAD_FAILED',
              },
            };
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
        originalFilename: file.name,
        contentType: file.type || null,
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
