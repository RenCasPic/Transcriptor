import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NewProjectForm } from './new-project-form';
import { getTemplateById } from '@/lib/data/templates';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getDictionary();
  return { title: dictionary.projects.new.title };
}

interface NewProjectPageProps {
  searchParams: Promise<{ template?: string }>;
}

export default async function NewProjectPage({ searchParams }: NewProjectPageProps) {
  const params = await searchParams;
  const template = params.template ? await getTemplateById(params.template) : null;
  const { dictionary: t } = await getDictionary();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.projects.new.title}</h1>
        <p className="text-sm text-muted-foreground">
          {template
            ? `${t.projects.new.usingTemplate} "${template.name}"${t.projects.new.usingTemplateSuffix}`
            : t.projects.new.subtitle}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t.projects.new.detailsTitle}</CardTitle>
          <CardDescription>{t.projects.new.detailsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <NewProjectForm template={template} />
        </CardContent>
      </Card>
    </div>
  );
}
