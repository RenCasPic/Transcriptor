import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditProjectDialog } from '@/components/projects/edit-project-dialog';
import { CONTENT_TYPE_LABELS, ARTICLE_TONE_LABELS } from '@/lib/types/domain';
import type { Database } from '@/lib/types/database';

type ProjectRow = Database['public']['Tables']['projects']['Row'];

export function ProjectInfoPanel({ project }: { project: ProjectRow }) {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Datos del proyecto</h3>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${project.id}`}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
      <dl className="space-y-2 text-xs">
        <Row label="Tipo de contenido" value={CONTENT_TYPE_LABELS[project.content_type]} />
        <Row label="Tono" value={ARTICLE_TONE_LABELS[project.tone]} />
        <Row label="Audiencia" value={project.audience ?? 'No especificada'} />
        <Row label="Idioma" value={project.language} />
        <Row label="Palabra clave" value={project.primary_keyword ?? 'Ninguna'} />
        <Row label="Objetivo" value={project.objective ?? 'No especificado'} />
        <Row label="CTA" value={project.call_to_action ?? 'Ninguna'} />
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
