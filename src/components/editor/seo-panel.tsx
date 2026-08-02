'use client';

import { useState } from 'react';
import { Loader2, Check, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { updateSeoMetadataAction, updateDocumentExcerptAction, regenerateSeoAction } from '@/lib/actions/editor';
import { computeSeoChecklist } from '@/lib/content/seo-checklist';
import { cn } from '@/lib/utils';

export interface SeoPanelData {
  seoTitle: string;
  slug: string;
  metaDescription: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
}

export function SeoPanel({
  documentId,
  documentTitle,
  initialExcerpt,
  initialSeo,
  wordCount,
  html,
}: {
  documentId: string;
  documentTitle: string;
  initialExcerpt: string;
  initialSeo: SeoPanelData;
  wordCount: number;
  html: string;
}) {
  const [seoTitle, setSeoTitle] = useState(initialSeo.seoTitle);
  const [slug, setSlug] = useState(initialSeo.slug);
  const [metaDescription, setMetaDescription] = useState(initialSeo.metaDescription);
  const [primaryKeyword, setPrimaryKeyword] = useState(initialSeo.primaryKeyword);
  const [secondaryKeywords, setSecondaryKeywords] = useState(initialSeo.secondaryKeywords.join(', '));
  const [excerpt, setExcerpt] = useState(initialExcerpt);
  const [isRegenerating, setIsRegenerating] = useState(false);

  async function persistSeo(overrides: Partial<SeoPanelData> = {}) {
    const result = await updateSeoMetadataAction({
      documentId,
      seoTitle: overrides.seoTitle ?? seoTitle,
      slug: overrides.slug ?? slug,
      metaDescription: overrides.metaDescription ?? metaDescription,
      primaryKeyword: overrides.primaryKeyword ?? primaryKeyword,
      secondaryKeywords:
        overrides.secondaryKeywords ??
        secondaryKeywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
    });
    if (!result.success) toast.error(result.error.message);
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    const result = await regenerateSeoAction({ documentId });
    setIsRegenerating(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Metadata SEO regenerada. Recarga para ver los cambios.');
  }

  const checklist = computeSeoChecklist({
    title: documentTitle,
    seoTitle,
    slug,
    metaDescription,
    primaryKeyword: primaryKeyword || null,
    html,
    wordCount,
  });

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">SEO</h3>
        <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={isRegenerating}>
          {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Regenerar
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="seo-title">Título SEO</Label>
        <Input
          id="seo-title"
          value={seoTitle}
          onChange={(e) => setSeoTitle(e.target.value)}
          onBlur={() => persistSeo()}
        />
        <p className="text-xs text-muted-foreground">{seoTitle.length} caracteres (recomendado 40-60)</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="seo-slug">Slug</Label>
        <Input id="seo-slug" value={slug} onChange={(e) => setSlug(e.target.value)} onBlur={() => persistSeo()} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="seo-meta">Meta description</Label>
        <Textarea
          id="seo-meta"
          rows={3}
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          onBlur={() => persistSeo()}
        />
        <p className="text-xs text-muted-foreground">{metaDescription.length} caracteres (recomendado ≤ 155)</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="seo-keyword">Palabra clave principal</Label>
        <Input
          id="seo-keyword"
          value={primaryKeyword}
          onChange={(e) => setPrimaryKeyword(e.target.value)}
          onBlur={() => persistSeo()}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="seo-secondary">Palabras clave secundarias</Label>
        <Input
          id="seo-secondary"
          placeholder="separadas por comas"
          value={secondaryKeywords}
          onChange={(e) => setSecondaryKeywords(e.target.value)}
          onBlur={() => persistSeo()}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="seo-excerpt">Extracto</Label>
        <Textarea
          id="seo-excerpt"
          rows={3}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          onBlur={async () => {
            const result = await updateDocumentExcerptAction({ documentId, excerpt });
            if (!result.success) toast.error(result.error.message);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Vista previa aproximada</Label>
        <div className="rounded-md border p-3">
          <p className="truncate text-sm text-primary">{seoTitle || documentTitle}</p>
          <p className="truncate text-xs text-success">tuartículo.com/{slug}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{metaDescription}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Checklist SEO</Label>
        <ul className="space-y-1.5">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-xs">
              {item.passed ? (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              ) : (
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className={cn(!item.passed && 'text-muted-foreground')}>{item.label}</span>
            </li>
          ))}
        </ul>
        <p className="pt-1 text-xs text-muted-foreground">
          Este checklist es una guía orientativa: no garantiza posicionamiento en buscadores.
        </p>
      </div>
    </div>
  );
}
