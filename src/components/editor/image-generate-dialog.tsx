'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
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
import {
  discardGeneratedImageAction,
  generateArticleImageAction,
  suggestImagePromptAction,
} from '@/lib/actions/images';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export interface GeneratedImageChoice {
  url: string;
  prompt: string;
  alt: string;
}

/**
 * Diálogo para generar una imagen con IA: descripción editable → "Generar" →
 * vista previa → aceptar o descartar. Sirve para regenerar una imagen del
 * artículo, para la portada y para insertar una imagen nueva donde está el
 * cursor. La imagen generada se sube a Storage al instante, pero el documento
 * NO cambia hasta que se acepta; al descartar (o cerrar) se borra del bucket.
 */
export function ImageGenerateDialog({
  open,
  onOpenChange,
  documentId,
  title,
  description,
  initialPrompt,
  initialAlt,
  suggestFromText,
  imagesAvailable,
  onAccept,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  title: string;
  description: string;
  initialPrompt: string;
  initialAlt: string;
  /** Si hay texto (y no hay descripción previa), la IA sugiere la descripción a partir de él. */
  suggestFromText?: string;
  imagesAvailable: boolean;
  onAccept: (choice: GeneratedImageChoice) => void | Promise<void>;
}) {
  const t = useDictionary();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [alt, setAlt] = useState(initialAlt);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'suggesting' | 'generating' | 'accepting'>('idle');
  const generatedRef = useRef<string | null>(null);
  generatedRef.current = generatedUrl;

  // Al abrir: valores iniciales y, si procede, descripción sugerida por la IA.
  useEffect(() => {
    if (!open) return;
    setPrompt(initialPrompt);
    setAlt(initialAlt);
    setGeneratedUrl(null);
    setStatus('idle');

    if (initialPrompt.trim() || !suggestFromText?.trim() || !imagesAvailable) return;
    let cancelled = false;
    setStatus('suggesting');
    void suggestImagePromptAction({ documentId, text: suggestFromText }).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setPrompt(result.data.prompt);
        setAlt(result.data.alt);
      }
      setStatus('idle');
    });
    return () => {
      cancelled = true;
    };
    // Solo al abrir el diálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function errorMessage(code: string, fallback: string): string {
    const errors = t.editor.images.errors as Record<string, string>;
    return errors[code] ?? fallback ?? errors.default!;
  }

  async function discardPreview(url: string | null) {
    if (!url) return;
    await discardGeneratedImageAction({ documentId, url });
  }

  async function handleGenerate() {
    const previous = generatedRef.current;
    setStatus('generating');
    const result = await generateArticleImageAction({ documentId, prompt });
    if (!result.success) {
      toast.error(errorMessage(result.error.code, result.error.message));
      setStatus('idle');
      return;
    }
    setGeneratedUrl(result.data.url);
    setStatus('idle');
    // Al generar otra, la vista previa anterior (no aceptada) se borra.
    void discardPreview(previous);
  }

  async function handleAccept() {
    if (!generatedUrl) return;
    setStatus('accepting');
    try {
      await onAccept({ url: generatedUrl, prompt: prompt.trim(), alt: alt.trim() });
      // Aceptada: ya no es una vista previa descartable.
      setGeneratedUrl(null);
      generatedRef.current = null;
      onOpenChange(false);
    } finally {
      setStatus('idle');
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      void discardPreview(generatedRef.current);
      setGeneratedUrl(null);
    }
    onOpenChange(next);
  }

  const busy = status !== 'idle';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="image-prompt">{t.editor.images.promptLabel}</Label>
            {status === 'suggesting' && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t.editor.images.suggesting}
              </p>
            )}
            <Textarea
              id="image-prompt"
              rows={4}
              value={prompt}
              maxLength={1000}
              placeholder={t.editor.images.promptPlaceholder}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">{t.editor.images.promptHelp}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="image-alt">{t.editor.images.altLabel}</Label>
            <Textarea
              id="image-alt"
              rows={2}
              value={alt}
              maxLength={300}
              onChange={(e) => setAlt(e.target.value)}
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">{t.editor.images.altHelp}</p>
          </div>

          {!imagesAvailable && (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-muted-foreground">
              {t.editor.images.unavailableHint}
            </p>
          )}

          {(generatedUrl || status === 'generating') && (
            <div className="overflow-hidden rounded-lg border bg-muted/30">
              {status === 'generating' ? (
                <div className="flex aspect-[3/2] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t.editor.images.generating}
                  <span className="text-xs">{t.editor.images.generatingHint}</span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={generatedUrl!} alt={t.editor.images.previewAlt} className="max-h-[38vh] w-full object-contain" />
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {generatedUrl ? (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void discardPreview(generatedUrl);
                  setGeneratedUrl(null);
                }}
              >
                {t.editor.images.discard}
              </Button>
              <Button variant="outline" disabled={busy || !imagesAvailable || prompt.trim().length < 5} onClick={handleGenerate}>
                {t.editor.images.generateAnother}
              </Button>
              <Button disabled={busy} onClick={handleAccept}>
                {status === 'accepting' && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.editor.images.accept}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={status === 'generating'} onClick={() => handleOpenChange(false)}>
                {t.editor.images.cancel}
              </Button>
              <Button
                disabled={busy || !imagesAvailable || prompt.trim().length < 5}
                title={imagesAvailable ? undefined : t.editor.images.unavailableHint}
                onClick={handleGenerate}
              >
                {status === 'generating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {t.editor.images.generate}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
