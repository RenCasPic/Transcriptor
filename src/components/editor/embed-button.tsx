'use client';

import { useState } from 'react';
import { Globe, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setDocumentPublicAction } from '@/lib/actions/embed';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export function EmbedButton({ documentId, initialIsPublic }: { documentId: string; initialIsPublic: boolean }) {
  const t = useDictionary();
  const [open, setOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [isToggling, setIsToggling] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const embedUrl = `${origin}/embed/${documentId}`;
  const iframeSnippet = `<iframe src="${embedUrl}" width="100%" height="700" style="border:none;max-width:100%;" loading="lazy"></iframe>`;

  async function handleToggle(next: boolean) {
    setIsToggling(true);
    try {
      const result = await setDocumentPublicAction({ documentId, isPublic: next });
      if (!result.success) {
        toast.error(result.error.message || t.editor.embedDialog.toggleError);
        return;
      }
      setIsPublic(next);
      toast.success(next ? t.editor.embedDialog.publishSuccess : t.editor.embedDialog.unpublishSuccess);
    } catch {
      toast.error(t.editor.embedDialog.toggleError);
    } finally {
      setIsToggling(false);
    }
  }

  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error(t.editor.embedDialog.copyError);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isPublic ? 'outline' : 'default'} size="sm">
          <Globe className="h-4 w-4" />
          {isPublic ? t.editor.actions.published : t.editor.actions.publish}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.editor.embedDialog.title}</DialogTitle>
          <DialogDescription>{t.editor.embedDialog.description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">{t.editor.embedDialog.publicToggleLabel}</p>
            {!isPublic && <p className="mt-0.5 text-xs text-muted-foreground">{t.editor.embedDialog.hint}</p>}
          </div>
          <Button
            size="sm"
            variant={isPublic ? 'outline' : 'default'}
            onClick={() => handleToggle(!isPublic)}
            disabled={isToggling}
          >
            {isToggling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isPublic ? t.editor.embedDialog.disableLabel : t.editor.embedDialog.enableLabel}
          </Button>
        </div>

        {isPublic && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="embed-link">{t.editor.embedDialog.linkLabel}</Label>
              <div className="flex gap-2">
                <Input id="embed-link" readOnly value={embedUrl} className="text-xs" onFocus={(e) => e.target.select()} />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyToClipboard(embedUrl, t.editor.embedDialog.copyLinkSuccess)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="embed-code">{t.editor.embedDialog.iframeLabel}</Label>
              <textarea
                id="embed-code"
                readOnly
                rows={3}
                value={iframeSnippet}
                onFocus={(e) => e.target.select()}
                className="w-full resize-none rounded-md border bg-muted/30 p-2 font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(iframeSnippet, t.editor.embedDialog.copyCodeSuccess)}
              >
                <Copy className="h-3.5 w-3.5" />
                {t.editor.embedDialog.copyCode}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
