'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { saveDocumentAction } from '@/lib/actions/editor';
import type { Json } from '@/lib/types/database';

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

export interface DocumentSnapshot {
  title: string;
  contentJson: Json;
  contentHtml: string;
}

const AUTOSAVE_DEBOUNCE_MS = 1200;
const SAVE_TIMEOUT_MS = 45_000;
const AUTOSAVE_ERROR_MESSAGE = 'No se pudo guardar. Reintentaremos al seguir editando; si persiste, recarga la página.';

export function useAutosave(documentId: string, initialVersion: number) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [readingTimeMinutes, setReadingTimeMinutes] = useState<number | null>(null);
  const versionRef = useRef(initialVersion);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<DocumentSnapshot | null>(null);
  const savingRef = useRef(false);

  const flush = useCallback(async () => {
    if (savingRef.current || !pendingRef.current) return;
    const snapshot = pendingRef.current;
    pendingRef.current = null;
    savingRef.current = true;
    setStatus('saving');

    let result: Awaited<ReturnType<typeof saveDocumentAction>>;
    try {
      // Con tope de tiempo: si el servidor no responde, no se queda "Guardando..." para siempre.
      result = await Promise.race([
        saveDocumentAction({
          documentId,
          title: snapshot.title,
          // editor.getJSON() devuelve `attrs` con prototipo nulo (ProseMirror) y React 19
          // no puede enviarlos a una Server Action ("temporary client reference"):
          // se pasa por JSON para que lleguen como objetos planos.
          contentJson: JSON.parse(JSON.stringify(snapshot.contentJson)),
          contentHtml: snapshot.contentHtml,
          expectedVersion: versionRef.current,
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SAVE_TIMEOUT')), SAVE_TIMEOUT_MS)),
      ]);
    } catch (error) {
      // La Server Action lanzó una excepción (fallo del servidor, red, tiempo agotado...):
      // se libera el guardado, se avisa y los cambios quedan pendientes para reintentar.
      console.error('[autosave] El guardado falló:', error);
      savingRef.current = false;
      if (!pendingRef.current) pendingRef.current = snapshot;
      setStatus('error');
      toast.error(AUTOSAVE_ERROR_MESSAGE);
      return;
    }

    savingRef.current = false;

    if (!result.success) {
      if (result.error.code === 'VERSION_CONFLICT') {
        setStatus('conflict');
        toast.error(result.error.message);
      } else {
        setStatus('error');
        toast.error(result.error.message);
      }
      return;
    }

    versionRef.current = result.data.version;
    setWordCount(result.data.wordCount);
    setReadingTimeMinutes(result.data.readingTimeMinutes);
    setStatus('saved');

    // Si llegaron cambios mientras guardábamos, se reprograma el guardado.
    if (pendingRef.current) {
      void flush();
    }
  }, [documentId]);

  const scheduleSave = useCallback(
    (snapshot: DocumentSnapshot) => {
      pendingRef.current = snapshot;
      // Hay cambios locales aún sin guardar (durante la ventana de debounce).
      if (!savingRef.current) setStatus('dirty');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  /**
   * Guarda YA los cambios pendientes (sin esperar al debounce) y espera a que
   * termine cualquier guardado en curso. Lo usan los cambios de imagen para que
   * la versión del historial refleje el contenido recién modificado.
   */
  const flushNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    for (let i = 0; i < 50 && savingRef.current; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    await flush();
  }, [flush]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { status, scheduleSave, flushNow, wordCount, readingTimeMinutes, currentVersion: () => versionRef.current };
}
