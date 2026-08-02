'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { saveDocumentAction } from '@/lib/actions/editor';
import type { Json } from '@/lib/types/database';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export interface DocumentSnapshot {
  title: string;
  contentJson: Json;
  contentHtml: string;
}

const AUTOSAVE_DEBOUNCE_MS = 1200;

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

    const result = await saveDocumentAction({
      documentId,
      title: snapshot.title,
      contentJson: snapshot.contentJson,
      contentHtml: snapshot.contentHtml,
      expectedVersion: versionRef.current,
    });

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
      setStatus('idle');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flush();
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { status, scheduleSave, wordCount, readingTimeMinutes, currentVersion: () => versionRef.current };
}
