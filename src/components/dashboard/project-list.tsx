import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProjectCard } from '@/components/dashboard/project-card';
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
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
