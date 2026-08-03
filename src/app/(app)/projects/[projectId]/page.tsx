import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectStatusBadge } from '@/components/shared/status-badge';
import { EditProjectDialog } from '@/components/projects/edit-project-dialog';
import { DeleteProjectDialog } from '@/components/projects/delete-project-dialog';
import { ContentSourcePanel } from '@/components/projects/content-source-panel';
import { TranscriptPreview } from '@/components/projects/transcript-preview';
import { GenerateArticlePanel } from '@/components/projects/generate-article-panel';
import { getProjectById } from '@/lib/data/projects';
import { getLatestTranscript } from '@/lib/data/transcripts';
import { getDocumentByProject } from '@/lib/data/documents';
import { getCurrentWorkspace } from '@/lib/data/workspace';
import { getIntegration } from '@/lib/data/integrations';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getDomainLabels } from '@/lib/i18n/domain-labels';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getDictionary();
  return { title: dictionary.projects.detail.configTitle };
}

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  const [project, workspace] = await Promise.all([getProjectById(projectId), getCurrentWorkspace()]);

  if (!project || !workspace) {
    notFound();
  }

  const [transcript, document, youtube, { dictionary: t, locale }] = await Promise.all([
    getLatestTranscript(projectId),
    getDocumentByProject(projectId),
    getIntegration(workspace.id, 'youtube'),
    getDictionary(),
  ]);
  const domainLabels = getDomainLabels(locale);

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
        <div className="flex gap-2">
          <EditProjectDialog project={project} />
          <DeleteProjectDialog projectId={project.id} projectName={project.name} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.projects.detail.configTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <InfoItem label={t.projects.detail.contentType} value={domainLabels.contentType[project.content_type]} />
          <InfoItem label={t.projects.detail.tone} value={domainLabels.articleTone[project.tone]} />
          <InfoItem label={t.projects.detail.audience} value={project.audience ?? t.projects.detail.audienceEmpty} />
          <InfoItem label={t.projects.detail.keyword} value={project.primary_keyword ?? t.projects.detail.keywordEmpty} />
          <InfoItem
            label={t.projects.detail.objective}
            value={project.objective ?? t.projects.detail.objectiveEmpty}
            className="sm:col-span-2"
          />
          <InfoItem
            label={t.projects.detail.cta}
            value={project.call_to_action ?? t.projects.detail.ctaEmpty}
            className="sm:col-span-2"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.projects.detail.sourceTitle}</CardTitle>
          <CardDescription>
            {transcript ? t.projects.detail.sourceDescriptionHasTranscript : t.projects.detail.sourceDescriptionEmpty}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContentSourcePanel
            projectId={projectId}
            workspaceId={workspace.id}
            language={project.language}
            youtubeConnected={youtube.status === 'connected'}
          />
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
