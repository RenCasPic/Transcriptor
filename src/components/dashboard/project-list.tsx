'use client';

import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ProjectCard } from '@/components/dashboard/project-card';
import { QuickStartActions } from '@/components/dashboard/quick-start-actions';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { ProjectListItem } from '@/lib/data/projects';

export function ProjectList({
  projects,
  youtubeConnected,
}: {
  projects: ProjectListItem[];
  youtubeConnected: boolean;
}) {
  const t = useDictionary();

  if (projects.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{t.dashboard.emptyTitle}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t.dashboard.emptyDescription}</p>
          </div>
          <QuickStartActions youtubeConnected={youtubeConnected} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
