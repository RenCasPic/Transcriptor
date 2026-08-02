import Link from 'next/link';
import { FileText, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProjectStatusBadge } from '@/components/shared/status-badge';
import { formatRelativeDate } from '@/lib/content/format';
import type { ProjectListItem } from '@/lib/data/projects';

export function ProjectList({ projects }: { projects: ProjectListItem[] }) {
  if (projects.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Todavía no tienes proyectos</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Crea tu primer proyecto, pega una transcripción y genera tu primer borrador de
              artículo en minutos.
            </p>
          </div>
          <Button asChild>
            <Link href="/projects/new">Crear mi primer proyecto</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Link key={project.id} href={`/projects/${project.id}`}>
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </div>
                <ProjectStatusBadge status={project.status} />
              </div>
              <div>
                <h3 className="line-clamp-2 font-semibold">
                  {project.provisionalTitle || project.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Modificado {formatRelativeDate(project.updatedAt)}
                </p>
              </div>
              <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                <span>{project.wordCount.toLocaleString('es')} palabras</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
