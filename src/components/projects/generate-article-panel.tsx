'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, FilePenLine } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { generateArticleAction } from '@/lib/actions/generation';

export function GenerateArticlePanel({
  projectId,
  hasDocument,
}: {
  projectId: string;
  hasDocument: boolean;
}) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);
    const result = await generateArticleAction(projectId);
    setIsGenerating(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    toast.success('Artículo generado');
    router.push(`/projects/${projectId}/editor`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{hasDocument ? 'Regenerar artículo' : 'Generar artículo'}</CardTitle>
        <CardDescription>
          {hasDocument
            ? 'Esto reemplaza el contenido actual del documento con una nueva versión generada. La versión anterior queda en el historial.'
            : 'La IA reorganizará tu transcripción en un artículo estructurado, fiel a la fuente.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {hasDocument ? 'Regenerar artículo' : 'Generar artículo'}
        </Button>
        {hasDocument && (
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/editor`}>
              <FilePenLine className="h-4 w-4" />
              Abrir editor
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
