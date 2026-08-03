import type { Metadata } from 'next';
import { getCurrentWorkspace } from '@/lib/data/workspace';
import { listTemplates } from '@/lib/data/templates';
import { TemplatesSection } from '@/components/dashboard/templates-section';

export const metadata: Metadata = { title: 'Plantillas' };

export default async function TemplatesPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const templates = await listTemplates(workspace.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plantillas</h1>
        <p className="text-sm text-muted-foreground">
          Guarda configuraciones de audiencia, tono y objetivo para reutilizarlas al crear proyectos nuevos.
        </p>
      </div>
      <TemplatesSection templates={templates} />
    </div>
  );
}
