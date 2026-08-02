import type {
  ContentType,
  ArticleTone,
  ProjectStatus,
  WorkspaceRole,
  WarningType,
  WarningStatus,
  MediaSourceType,
} from '@/lib/types/database';

export type {
  ContentType,
  ArticleTone,
  ProjectStatus,
  WorkspaceRole,
  WarningType,
  WarningStatus,
  MediaSourceType,
};

/** Respuesta uniforme para todas las Server Actions de la aplicación. */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function err<T = never>(code: string, message: string): ActionResult<T> {
  return { success: false, error: { code, message } };
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Borrador',
  processing: 'Procesando',
  review: 'En revisión',
  ready: 'Listo',
  published: 'Publicado',
  failed: 'Fallido',
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  tutorial: 'Tutorial',
  guide: 'Guía',
  list: 'Lista',
  interview: 'Entrevista',
  summary: 'Resumen',
  case_study: 'Caso de estudio',
  opinion: 'Artículo de opinión',
  qa: 'Preguntas y respuestas',
};

export const ARTICLE_TONE_LABELS: Record<ArticleTone, string> = {
  professional: 'Profesional',
  educational: 'Educativo',
  conversational: 'Conversacional',
  persuasive: 'Persuasivo',
  technical: 'Técnico',
  friendly: 'Cercano',
};

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Lector',
};

export const WARNING_TYPE_LABELS: Record<WarningType, string> = {
  unsupported_claim: 'Afirmación no respaldada',
  number_verification: 'Verificar cifra',
  name_verification: 'Verificar nombre propio',
  date_verification: 'Verificar fecha',
  possible_hallucination: 'Posible alucinación',
  missing_source: 'Fuente faltante',
};

export const WARNING_STATUS_LABELS: Record<WarningStatus, string> = {
  open: 'Abierta',
  reviewed: 'Revisada',
  resolved: 'Resuelta',
  dismissed: 'Descartada',
};

export const MEDIA_SOURCE_LABELS: Record<MediaSourceType, string> = {
  manual: 'Texto pegado',
  txt: 'Archivo TXT',
  srt: 'Archivo SRT',
  vtt: 'Archivo VTT',
  audio: 'Audio',
  video: 'Video',
  youtube: 'YouTube',
};
