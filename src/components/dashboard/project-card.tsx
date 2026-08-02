'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, MoreVertical, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ProjectStatusBadge } from '@/components/shared/status-badge';
import { formatRelativeDate } from '@/lib/content/format';
import { deleteProjectAction } from '@/lib/actions/projects';
import type { ProjectListItem } from '@/lib/data/projects';

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteProjectAction(project.id);
    setIsDeleting(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    toast.success('Proyecto eliminado');
    setConfirmOpen(false);
    router.refresh();
  }

  return (
    <>
      <Card className="relative h-full transition-shadow hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <ProjectStatusBadge status={project.status} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative z-10 h-7 w-7 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Opciones del proyecto</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setConfirmOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div>
            <h3 className="line-clamp-2 font-semibold">{project.provisionalTitle || project.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Modificado {formatRelativeDate(project.updatedAt)}
            </p>
          </div>
          <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
            <span>{project.wordCount.toLocaleString('es')} palabras</span>
          </div>

          <Link href={`/projects/${project.id}`} className="absolute inset-0" aria-label={project.name}>
            <span className="sr-only">Abrir proyecto {project.name}</span>
          </Link>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar &quot;{project.name}&quot;?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará el proyecto junto con su transcripción,
              el artículo generado, el historial de versiones y todas las alertas asociadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
