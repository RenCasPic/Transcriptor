'use client';

import { createContext, useContext } from 'react';

export interface EditorImageContextValue {
  documentId: string;
  projectId: string;
  workspaceId: string;
  /** Hay clave de OpenAI en el servidor (sin ella solo se pueden subir imágenes propias). */
  imagesAvailable: boolean;
  /**
   * Llamar tras cualquier cambio de imagen: fuerza el autoguardado y deja una
   * entrada en el historial de versiones con el motivo indicado.
   */
  commitImageChange: (reason: string) => void;
}

const EditorImageContext = createContext<EditorImageContextValue | null>(null);

export const EditorImageProvider = EditorImageContext.Provider;

export function useEditorImageContext(): EditorImageContextValue {
  const value = useContext(EditorImageContext);
  if (!value) throw new Error('useEditorImageContext debe usarse dentro de <EditorImageProvider>');
  return value;
}
