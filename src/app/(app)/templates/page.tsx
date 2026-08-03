import type { Metadata } from 'next';
import { getCurrentWorkspace } from '@/lib/data/workspace';
import { listTemplates } from '@/lib/data/templates';
import { TemplatesSection } from '@/components/dashboard/templates-section';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getDictionary();
  return { title: dictionary.templates.title };
}

export default async function TemplatesPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const templates = await listTemplates(workspace.id);
  const { dictionary: t } = await getDictionary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.templates.title}</h1>
        <p className="text-sm text-muted-foreground">{t.templates.subtitle}</p>
      </div>
      <TemplatesSection templates={templates} />
    </div>
  );
}
