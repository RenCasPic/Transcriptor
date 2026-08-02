import Link from 'next/link';
import type { Metadata } from 'next';
import { FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardFilters } from '@/components/dashboard/dashboard-filters';
import { ProjectList } from '@/components/dashboard/project-list';
import { getCurrentWorkspace } from '@/lib/data/workspace';
import { listProjects } from '@/lib/data/projects';
import type { ProjectStatus } from '@/lib/types/database';

export const metadata: Metadata = { title: 'Panel' };

interface DashboardPageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const workspace = await getCurrentWorkspace();

  if (!workspace) {
    return null;
  }

  const status = (params.status as ProjectStatus | undefined) ?? 'all';
  const projects = await listProjects(workspace.id, { search: params.q, status });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tus proyectos</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona tus artículos generados a partir de transcripciones
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <FolderPlus className="h-4 w-4" />
            Nuevo proyecto
          </Link>
        </Button>
      </div>

      <DashboardFilters initialSearch={params.q ?? ''} initialStatus={status} />

      <ProjectList projects={projects} />
    </div>
  );
}
