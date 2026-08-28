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
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export interface SeoPanelData {
  seoTitle: string;
  slug: string;
  metaDescription: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
}

const SEO_TITLE_MAX = 60;
const META_DESCRIPTION_MAX = 155;

function CharCounter({ length, max }: { length: number; max: number }) {
  const over = length > max;
  return (
    <span
      className={cn(
        'tabular-nums text-xs font-medium',
        over ? 'text-destructive' : length > max * 0.85 ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground',
      )}
    >
      {length} / {max}
    </span>
  );
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
  const t = useDictionary();
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
    toast.success(t.editor.seoPanel.regenerateSuccess);
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
  const passed = checklist.filter((c) => c.passed).length;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {passed}/{checklist.length} {t.editor.seoPanel.checkedLabel}
        </span>
        <Button size="sm" variant="ghost" onClick={handleRegenerate} disabled={isRegenerating}>
          {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {t.editor.seoPanel.regenerate}
        </Button>
      </div>

      {/* Vista previa tipo resultado de Google */}
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t.editor.seoPanel.googlePreviewLabel}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
            A
          </span>
          tuartículo.com <span aria-hidden>›</span> {slug || 'articulo'}
        </p>
        <p className="mt-1 line-clamp-2 text-base leading-snug text-[#1a0dab] dark:text-indigo-300">
          {seoTitle || documentTitle}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
          {metaDescription || t.editor.seoPanel.metaDescriptionEmpty}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-title">{t.editor.seoPanel.seoTitleLabel}</Label>
          <CharCounter length={seoTitle.length} max={SEO_TITLE_MAX} />
        </div>
        <Input id="seo-title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} onBlur={() => persistSeo()} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="seo-slug">{t.editor.seoPanel.slugLabel}</Label>
        <Input id="seo-slug" value={slug} onChange={(e) => setSlug(e.target.value)} onBlur={() => persistSeo()} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-meta">{t.editor.seoPanel.metaDescriptionLabel}</Label>
          <CharCounter length={metaDescription.length} max={META_DESCRIPTION_MAX} />
        </div>
        <Textarea
          id="seo-meta"
          rows={3}
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          onBlur={() => persistSeo()}
        />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="seo-keyword">{t.editor.seoPanel.keywordLabel}</Label>
          <Input
            id="seo-keyword"
            value={primaryKeyword}
            onChange={(e) => setPrimaryKeyword(e.target.value)}
            onBlur={() => persistSeo()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seo-secondary">{t.editor.seoPanel.secondaryKeywordsLabel}</Label>
          <Input
            id="seo-secondary"
            placeholder={t.editor.seoPanel.secondaryKeywordsPlaceholder}
            value={secondaryKeywords}
            onChange={(e) => setSecondaryKeywords(e.target.value)}
            onBlur={() => persistSeo()}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="seo-excerpt">{t.editor.seoPanel.excerptLabel}</Label>
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

      <div className="space-y-1.5 border-t pt-3">
        <Label>{t.editor.seoPanel.checklistLabel}</Label>
        <ul className="space-y-1.5">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-xs">
              {item.passed ? (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
              ) : (
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              )}
              <span className={cn(!item.passed && 'text-muted-foreground')}>
                {t.editor.seoPanel.checklist[item.id]}
              </span>
            </li>
          ))}
        </ul>
        <p className="pt-1 text-[11px] text-muted-foreground">{t.editor.seoPanel.checklistDisclaimer}</p>
      </div>
    </div>
  );
}
