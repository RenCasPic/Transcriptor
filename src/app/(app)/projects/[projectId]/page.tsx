import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectStatusBadge } from '@/components/shared/status-badge';
import { EditProjectDialog } from '@/components/projects/edit-project-dialog';
import { ContentSourcePanel } from '@/components/projects/content-source-panel';
import { TranscriptPreview } from '@/components/projects/transcript-preview';
import { GenerateArticlePanel } from '@/components/projects/generate-article-panel';
import { getProjectById } from '@/lib/data/projects';
import { getLatestTranscript } from '@/lib/data/transcripts';
import { getDocumentByProject } from '@/lib/data/documents';
import { getCurrentWorkspace } from '@/lib/data/workspace';
import { CONTENT_TYPE_LABELS, ARTICLE_TONE_LABELS } from '@/lib/types/domain';

export const metadata: Metadata = { title: 'Proyecto' };

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  const [project, workspace] = await Promise.all([getProjectById(projectId), getCurrentWorkspace()]);

  if (!project || !workspace) {
    notFound();
  }

  const [transcript, document] = await Promise.all([
    getLatestTranscript(projectId),
    getDocumentByProject(projectId),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          {project.provisional_title && (
            <p className="mt-1 text-sm text-muted-foreground">{project.provisional_title}</p>
          )}
        </div>
        <EditProjectDialog project={project} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuración del artículo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <InfoItem label="Tipo de contenido" value={CONTENT_TYPE_LABELS[project.content_type]} />
          <InfoItem label="Tono" value={ARTICLE_TONE_LABELS[project.tone]} />
          <InfoItem label="Audiencia" value={project.audience ?? 'No especificada'} />
          <InfoItem label="Palabra clave principal" value={project.primary_keyword ?? 'Ninguna'} />
          <InfoItem label="Objetivo" value={project.objective ?? 'No especificado'} className="sm:col-span-2" />
          <InfoItem label="Llamada a la acción" value={project.call_to_action ?? 'Ninguna'} className="sm:col-span-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fuente de contenido</CardTitle>
          <CardDescription>
            {transcript
              ? 'Ya tienes una transcripción cargada. Puedes reemplazarla importando una nueva.'
              : 'Añade una transcripción para poder generar el artículo.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContentSourcePanel projectId={projectId} workspaceId={workspace.id} language={project.language} />
        </CardContent>
      </Card>

      {transcript && <TranscriptPreview transcript={transcript} />}

      {transcript && <GenerateArticlePanel projectId={projectId} hasDocument={!!document} />}
    </div>
  );
}

function InfoItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
