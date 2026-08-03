'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutTemplate, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CreateTemplateDialog } from './create-template-dialog';
import { deleteTemplateAction } from '@/lib/actions/templates';
import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';
import { getDomainLabels } from '@/lib/i18n/domain-labels';
import type { ProjectTemplateItem } from '@/lib/data/templates';

export function TemplatesSection({ templates }: { templates: ProjectTemplateItem[] }) {
  const router = useRouter();
  const t = useDictionary();
  const locale = useLocale();
  const domainLabels = getDomainLabels(locale);
  const [templateToDelete, setTemplateToDelete] = useState<ProjectTemplateItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!templateToDelete) return;
    setIsDeleting(true);
    const result = await deleteTemplateAction(templateToDelete.id);
    setIsDeleting(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    toast.success(t.templates.deleteSuccess);
    setTemplateToDelete(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <LayoutTemplate className="h-4 w-4 text-violet-600" />
            {t.templates.sectionTitle}
          </h2>
          <p className="text-xs text-muted-foreground">{t.templates.sectionDescription}</p>
        </div>
        <CreateTemplateDialog />
      </div>

      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-4 text-sm text-muted-foreground">{t.templates.empty}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-1 text-sm font-semibold">{template.name}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => setTemplateToDelete(template)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {domainLabels.contentType[template.contentType]} · {domainLabels.articleTone[template.tone]}
                </p>
                {template.audience && (
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {t.templates.audienceLabel}: {template.audience}
                  </p>
                )}
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <Link href={`/projects/new?template=${template.id}`}>{t.templates.useTemplate}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t.templates.deleteTitle} &quot;{templateToDelete?.name}&quot;?
            </DialogTitle>
            <DialogDescription>{t.templates.deleteDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateToDelete(null)} disabled={isDeleting}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.templates.deleteConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
