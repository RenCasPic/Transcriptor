import Link from 'next/link';
import type { Metadata } from 'next';
import { FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardFilters } from '@/components/dashboard/dashboard-filters';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { ProjectList } from '@/components/dashboard/project-list';
import { getCurrentWorkspace } from '@/lib/data/workspace';
import { listProjects } from '@/lib/data/projects';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import type { ProjectStatus } from '@/lib/types/database';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getDictionary();
  return { title: dictionary.dashboard.title };
}

interface DashboardPageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const workspace = await getCurrentWorkspace();
  const { dictionary: t } = await getDictionary();

  if (!workspace) {
    return null;
  }

  const status = (params.status as ProjectStatus | undefined) ?? 'all';
  const [projects, allProjects] = await Promise.all([
    listProjects(workspace.id, { search: params.q, status }),
    listProjects(workspace.id, {}),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.dashboard.title}</h1>
          <p className="text-sm text-muted-foreground">{t.dashboard.subtitle}</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <FolderPlus className="h-4 w-4" />
            {t.dashboard.newProject}
          </Link>
        </Button>
      </div>

      <DashboardStats projects={allProjects} />

      <DashboardFilters initialSearch={params.q ?? ''} initialStatus={status} />

      <ProjectList projects={projects} />
    </div>
  );
}
