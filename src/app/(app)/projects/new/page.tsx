import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NewProjectForm } from './new-project-form';

export const metadata: Metadata = { title: 'Nuevo proyecto' };

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo proyecto</h1>
        <p className="text-sm text-muted-foreground">
          Define cómo quieres que sea tu artículo antes de generarlo
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Detalles del proyecto</CardTitle>
          <CardDescription>
            Estos datos guían la generación automática: audiencia, tono, tipo de contenido y
            objetivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewProjectForm />
        </CardContent>
      </Card>
    </div>
  );
}
