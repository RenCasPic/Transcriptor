'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Comparar versiones</DialogTitle>
          <DialogDescription>Comparación lado a lado del contenido actual y la versión {versionNumber}.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Versión {versionNumber}
            </p>
            <div className="rounded-md border p-3">
              <h4 className="mb-2 font-semibold">{versionTitle}</h4>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: versionHtml }} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Contenido actual</p>
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
