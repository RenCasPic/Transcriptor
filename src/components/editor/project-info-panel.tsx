'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditProjectDialog } from '@/components/projects/edit-project-dialog';
import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';
import { getDomainLabels } from '@/lib/i18n/domain-labels';
import type { Database } from '@/lib/types/database';

type ProjectRow = Database['public']['Tables']['projects']['Row'];

export function ProjectInfoPanel({ project }: { project: ProjectRow }) {
  const t = useDictionary();
  const locale = useLocale();
  const domainLabels = getDomainLabels(locale);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t.editor.projectInfo.title}</h3>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${project.id}`}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
      <dl className="space-y-2 text-xs">
        <Row label={t.editor.projectInfo.contentType} value={domainLabels.contentType[project.content_type]} />
        <Row label={t.editor.projectInfo.tone} value={domainLabels.articleTone[project.tone]} />
        <Row label={t.editor.projectInfo.audience} value={project.audience ?? t.editor.projectInfo.audienceEmpty} />
        <Row label={t.editor.projectInfo.language} value={project.language} />
        <Row label={t.editor.projectInfo.keyword} value={project.primary_keyword ?? t.editor.projectInfo.keywordEmpty} />
        <Row label={t.editor.projectInfo.objective} value={project.objective ?? t.editor.projectInfo.objectiveEmpty} />
        <Row label={t.editor.projectInfo.cta} value={project.call_to_action ?? t.editor.projectInfo.ctaEmpty} />
      </dl>
      <EditProjectDialog project={project} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
