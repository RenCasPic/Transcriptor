'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

/** Diálogo para editar el texto alternativo (alt) de una imagen. */
export function ImageAltDialog({
  open,
  onOpenChange,
  initialAlt,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAlt: string;
  onSave: (alt: string) => void | Promise<void>;
}) {
  const t = useDictionary();
  const [alt, setAlt] = useState(initialAlt);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setAlt(initialAlt);
  }, [open, initialAlt]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(alt.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.editor.images.altDialogTitle}</DialogTitle>
          <DialogDescription>{t.editor.images.altDialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="image-alt-edit">{t.editor.images.altLabel}</Label>
          <Textarea
            id="image-alt-edit"
            rows={3}
            value={alt}
            maxLength={300}
            onChange={(e) => setAlt(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">{t.editor.images.altHelp}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.editor.images.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {t.editor.images.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
