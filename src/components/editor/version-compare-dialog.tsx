'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export function VersionCompareDialog({
  open,
  onOpenChange,
  currentHtml,
  currentTitle,
  versionHtml,
  versionTitle,
  versionNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentHtml: string;
  currentTitle: string;
  versionHtml: string;
  versionTitle: string;
  versionNumber: number;
}) {
  const t = useDictionary();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t.editor.history.compareTitle}</DialogTitle>
          <DialogDescription>
            {t.editor.history.compareDescription} {versionNumber}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.editor.history.version} {versionNumber}
            </p>
            <div className="rounded-md border p-3">
              <h4 className="mb-2 font-semibold">{versionTitle}</h4>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: versionHtml }} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.editor.history.currentContent}
            </p>
            <div className="rounded-md border p-3">
              <h4 className="mb-2 font-semibold">{currentTitle}</h4>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: currentHtml }} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
