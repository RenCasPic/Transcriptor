'use client';

import { useEffect, useRef, useState } from 'react';

export interface EditorScrollInfo {
  /** Índice del capítulo (h2) actualmente bajo la cabeza de registro. */
  activeIndex: number;
  /** Progreso de lectura del documento, 0–1. */
  progress: number;
  /** Cuántos capítulos (h2) hay. */
  count: number;
}

/**
 * Posición de la "cabeza de registro" en el manuscrito. Un único listener de
 * scroll compartido por la regla (`EditorScale`) y la línea de registro
 * (`EditorRegistration`) para no duplicar trabajo.
 */
export function useEditorScroll(): EditorScrollInfo {
  const [info, setInfo] = useState<EditorScrollInfo>({ activeIndex: 0, progress: 0, count: 0 });
  const raf = useRef(false);

  useEffect(() => {
    function measure() {
      raf.current = false;
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.tiptap-editor h2'));
      const head = window.innerHeight * 0.22;
      let activeIndex = 0;
      nodes.forEach((n, i) => {
        if (n.getBoundingClientRect().top <= head) activeIndex = i;
      });
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      setInfo({ activeIndex, progress, count: nodes.length });
    }
    function onScroll() {
      if (raf.current) return;
      raf.current = true;
      requestAnimationFrame(measure);
    }
    measure();
    const id = window.setTimeout(measure, 400); // tras montar el editor
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return info;
}
