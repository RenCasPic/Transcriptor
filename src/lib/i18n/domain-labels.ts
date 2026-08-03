import type {
  ContentType,
  ArticleTone,
  ProjectStatus,
  WorkspaceRole,
  WarningType,
  WarningStatus,
  MediaSourceType,
} from '@/lib/types/database';
import type { Locale } from './config';

export interface DomainLabels {
  projectStatus: Record<ProjectStatus, string>;
  contentType: Record<ContentType, string>;
  articleTone: Record<ArticleTone, string>;
  workspaceRole: Record<WorkspaceRole, string>;
  warningType: Record<WarningType, string>;
  warningStatus: Record<WarningStatus, string>;
  mediaSource: Record<MediaSourceType, string>;
}

const es: DomainLabels = {
  projectStatus: {
    draft: 'Borrador',
    processing: 'Procesando',
    review: 'En revisión',
    ready: 'Listo',
    published: 'Publicado',
    failed: 'Fallido',
  },
  contentType: {
    tutorial: 'Tutorial',
    guide: 'Guía',
    list: 'Lista',
    interview: 'Entrevista',
    summary: 'Resumen',
    case_study: 'Caso de estudio',
    opinion: 'Artículo de opinión',
    qa: 'Preguntas y respuestas',
  },
  articleTone: {
    professional: 'Profesional',
    educational: 'Educativo',
    conversational: 'Conversacional',
    persuasive: 'Persuasivo',
    technical: 'Técnico',
    friendly: 'Cercano',
  },
  workspaceRole: {
    owner: 'Propietario',
    admin: 'Administrador',
    editor: 'Editor',
    viewer: 'Lector',
  },
  warningType: {
    unsupported_claim: 'Afirmación no respaldada',
    number_verification: 'Verificar cifra',
    name_verification: 'Verificar nombre propio',
    date_verification: 'Verificar fecha',
    possible_hallucination: 'Posible alucinación',
    missing_source: 'Fuente faltante',
  },
  warningStatus: {
    open: 'Abierta',
    reviewed: 'Revisada',
    resolved: 'Resuelta',
    dismissed: 'Descartada',
  },
  mediaSource: {
    manual: 'Texto pegado',
    txt: 'Archivo TXT',
    srt: 'Archivo SRT',
    vtt: 'Archivo VTT',
    audio: 'Audio',
    video: 'Video',
    youtube: 'YouTube',
  },
};

const en: DomainLabels = {
  projectStatus: {
    draft: 'Draft',
    processing: 'Processing',
    review: 'In review',
    ready: 'Ready',
    published: 'Published',
    failed: 'Failed',
  },
  contentType: {
    tutorial: 'Tutorial',
    guide: 'Guide',
    list: 'List',
    interview: 'Interview',
    summary: 'Summary',
    case_study: 'Case study',
    opinion: 'Opinion piece',
    qa: 'Q&A',
  },
  articleTone: {
    professional: 'Professional',
    educational: 'Educational',
    conversational: 'Conversational',
    persuasive: 'Persuasive',
    technical: 'Technical',
    friendly: 'Friendly',
  },
  workspaceRole: {
    owner: 'Owner',
    admin: 'Admin',
    editor: 'Editor',
    viewer: 'Viewer',
  },
  warningType: {
    unsupported_claim: 'Unsupported claim',
    number_verification: 'Verify figure',
    name_verification: 'Verify proper name',
    date_verification: 'Verify date',
    possible_hallucination: 'Possible hallucination',
    missing_source: 'Missing source',
  },
  warningStatus: {
    open: 'Open',
    reviewed: 'Reviewed',
    resolved: 'Resolved',
    dismissed: 'Dismissed',
  },
  mediaSource: {
    manual: 'Pasted text',
    txt: 'TXT file',
    srt: 'SRT file',
    vtt: 'VTT file',
    audio: 'Audio',
    video: 'Video',
    youtube: 'YouTube',
  },
};

const DOMAIN_LABELS: Record<Locale, DomainLabels> = { es, en };

export function getDomainLabels(locale: Locale): DomainLabels {
  return DOMAIN_LABELS[locale];
}
