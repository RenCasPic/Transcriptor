import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { EditorShell } from '@/components/editor/editor-shell';
import { getProjectById } from '@/lib/data/projects';
import { getLatestTranscript } from '@/lib/data/transcripts';
import {
  getDocumentByProject,
  getSeoMetadata,
  getContentWarnings,
  getContentSourceLinks,
} from '@/lib/data/documents';
import { getDocumentVersions } from '@/lib/data/versions';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Editor' };

// El botón "Regenerar" del editor dispara la generación multi-etapa del
// artículo (varias llamadas al proveedor de IA); necesita el mismo límite
// ampliado que el resto de rutas que generan contenido en Vercel.
export const maxDuration = 300;

interface EditorPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { projectId } = await params;

  const project = await getProjectById(projectId);
  if (!project) notFound();

  const document = await getDocumentByProject(projectId);
  if (!document) {
    redirect(`/projects/${projectId}`);
  }

  const [transcript, seo, warnings, sourceLinks, versions, supabase] = await Promise.all([
    getLatestTranscript(projectId),
    getSeoMetadata(document.id),
    getContentWarnings(document.id),
    getContentSourceLinks(document.id),
    getDocumentVersions(document.id),
    createClient(),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <EditorShell
      project={project}
      document={document}
      segments={transcript?.segments ?? []}
      seo={seo}
      warnings={warnings}
      sourceLinks={sourceLinks}
      versions={versions}
      currentUserId={user?.id ?? null}
    />
  );
}
