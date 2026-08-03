'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, FilePenLine } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { generateArticleAction } from '@/lib/actions/generation';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export function GenerateArticlePanel({
  projectId,
  hasDocument,
}: {
  projectId: string;
  hasDocument: boolean;
}) {
  const router = useRouter();
  const t = useDictionary();
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);
    const result = await generateArticleAction(projectId);
    setIsGenerating(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    toast.success(t.projects.detail.generatedSuccess);
    router.push(`/projects/${projectId}/editor`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {hasDocument ? t.projects.detail.regenerateTitle : t.projects.detail.generateTitle}
        </CardTitle>
        <CardDescription>
          {hasDocument ? t.projects.detail.regenerateDescription : t.projects.detail.generateDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {hasDocument ? t.projects.detail.regenerateButton : t.projects.detail.generateButton}
        </Button>
        {hasDocument && (
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/editor`}>
              <FilePenLine className="h-4 w-4" />
              {t.projects.detail.openEditor}
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
