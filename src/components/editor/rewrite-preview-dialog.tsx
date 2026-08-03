'use client';

import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export function RewritePreviewDialog({
  open,
  originalText,
  proposedText,
  isLoading,
  onAccept,
  onDiscard,
}: {
  open: boolean;
  originalText: string;
  proposedText: string | null;
  isLoading: boolean;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  const t = useDictionary();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDiscard()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.editor.rewritePreview.title}</DialogTitle>
          <DialogDescription>{t.editor.rewritePreview.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.editor.rewritePreview.original}
            </p>
            <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm">{originalText}</div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.editor.rewritePreview.proposed}
            </p>
            <div className="max-h-64 overflow-y-auto rounded-md border bg-primary/5 p-3 text-sm">
              {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.editor.rewritePreview.generating}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{proposedText}</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onDiscard}>
            {t.editor.rewritePreview.discard}
          </Button>
          <Button onClick={onAccept} disabled={isLoading || !proposedText}>
            {t.editor.rewritePreview.accept}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
