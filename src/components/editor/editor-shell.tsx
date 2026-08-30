'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ArticleEditor } from './article-editor';
import { EditorSpine } from './editor-spine';
import { EditorDrawerTabs } from './editor-drawer-tabs';
import { EditorPreview } from './editor-preview';
import { RegenerateButton } from './regenerate-button';
import { SaveStatusIndicator } from './save-status-indicator';
import { ExportMenu } from './export-menu';
import { EmbedButton } from './embed-button';
import type { AutosaveStatus } from '@/lib/editor/use-autosave';
import type { TranscriptSegmentItem } from '@/lib/data/transcripts';
import type { ContentDocumentRecord } from '@/lib/data/documents';
import type { DocumentVersionItem } from '@/lib/data/versions';
import type { WarningItem } from './warnings-panel';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { Database } from '@/lib/types/database';

type ProjectRow = Database['public']['Tables']['projects']['Row'];

export interface SeoMetadataRow {
  seo_title: string | null;
  slug: string | null;
  meta_description: string | null;
  primary_keyword: string | null;
  secondary_keywords: string[];
}

export interface SourceLinkRow {
  block_id: string;
  transcript_segment_id: string;
}

export function EditorShell({
  project,
  document,
  segments,
  seo,
  warnings,
  sourceLinks,
  versions,
  currentUserId,
}: {
  project: ProjectRow;
  document: ContentDocumentRecord;
  segments: TranscriptSegmentItem[];
  seo: SeoMetadataRow | null;
  warnings: WarningItem[];
  sourceLinks: SourceLinkRow[];
  versions: DocumentVersionItem[];
  currentUserId: string | null;
}) {
  const t = useDictionary();
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [panelSheetOpen, setPanelSheetOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>('idle');
  const [snapshot, setSnapshot] = useState({
    plainText: '',
    html: document.contentHtml,
    json: document.contentJson,
    wordCount: document.wordCount,
  });

  const sourceLinksByBlock = useMemo(() => {
    const map = new Map<string, string[]>();
    sourceLinks.forEach((link) => {
      const existing = map.get(link.block_id) ?? [];
      existing.push(link.transcript_segment_id);
      map.set(link.block_id, existing);
    });
    return map;
  }, [sourceLinks]);

  const usedSegmentIds = useMemo(() => new Set(sourceLinks.map((l) => l.transcript_segment_id)), [sourceLinks]);

  const seoData = {
    seoTitle: seo?.seo_title ?? document.title,
    slug: seo?.slug ?? '',
    metaDescription: seo?.meta_description ?? '',
    primaryKeyword: seo?.primary_keyword ?? project.primary_keyword ?? '',
    secondaryKeywords: seo?.secondary_keywords ?? [],
  };

  const openWarnings = warnings.filter((w) => w.status === 'open').length;

  const panel = (
    <EditorDrawerTabs
      documentId={document.id}
      projectId={project.id}
      documentTitle={document.title}
      excerpt={document.excerpt ?? ''}
      seo={seoData}
      wordCount={snapshot.wordCount}
      html={snapshot.html}
      contentJson={snapshot.json}
      warnings={warnings}
      sourceLinksByBlock={sourceLinksByBlock}
      segments={segments}
      usedSegmentIds={usedSegmentIds}
      selectedSegmentId={selectedSegmentId}
      onSelectSegment={setSelectedSegmentId}
      versions={versions}
      currentUserId={currentUserId}
      saveStatus={saveStatus}
    />
  );

  const monoBtn =
    'h-7 gap-1.5 rounded-none px-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-[hsl(var(--ed-ink-soft))] hover:bg-[hsl(var(--ed-paper-sunk))] hover:text-[hsl(var(--ed-ink))]';

  return (
    <div className="editor-surface -m-4 min-h-[calc(100vh-var(--app-header-h))] font-sans lg:-m-8">
      {/* CINTA SUPERIOR — casi invisible; solo lo esencial, en monoespaciada. */}
      <div className="sticky top-0 z-40 flex h-12 items-center justify-between gap-3 border-b border-[hsl(var(--ed-rule))] bg-[hsl(var(--ed-paper))]/90 px-3 backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-none text-[hsl(var(--ed-ink-faint))] hover:bg-[hsl(var(--ed-paper-sunk))] hover:text-[hsl(var(--ed-ink))]"
            asChild
          >
            <Link href={`/projects/${project.id}`} aria-label={t.editor.actions.back ?? 'Volver'}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <span className="ed-label hidden shrink-0 sm:inline">{t.editor.masthead.kicker}</span>
          <span aria-hidden className="hidden h-3 w-px bg-[hsl(var(--ed-rule-strong))] sm:block" />
          <span className="truncate font-mono text-[0.78rem] text-[hsl(var(--ed-ink))]">{project.name}</span>
        </div>

        <div className="flex items-center gap-1">
          <SaveStatusIndicator status={saveStatus} iconOnly />
          <Button variant="ghost" size="sm" className={`hidden sm:inline-flex ${monoBtn}`} onClick={() => setPreviewMode((v) => !v)}>
            <Eye className="h-3.5 w-3.5" />
            {t.editor.preview.enter}
          </Button>
          <RegenerateButton
            projectId={project.id}
            currentTargetReadingMinutes={project.target_reading_minutes}
            className={monoBtn}
          />
          <ExportMenu title={document.title} html={snapshot.html} json={snapshot.json} className={monoBtn} />
          <EmbedButton
            documentId={document.id}
            initialIsPublic={document.isPublic}
            className="h-7 gap-1.5 rounded-none border-0 bg-[hsl(var(--ed-accent))] px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-[hsl(var(--primary-foreground))] shadow-none hover:bg-[hsl(var(--ed-accent))]/90 hover:text-[hsl(var(--primary-foreground))]"
          />
          <Button
            variant="ghost"
            size="icon"
            className="relative h-7 w-7 rounded-none text-[hsl(var(--ed-ink-soft))] lg:hidden"
            onClick={() => setPanelSheetOpen(true)}
            aria-label={t.editor.panelTitle}
          >
            <PanelRight className="h-4 w-4" />
            {openWarnings > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))]" />}
          </Button>
        </div>
      </div>

      {previewMode ? (
        <EditorPreview
          title={document.title}
          html={snapshot.html}
          wordCount={snapshot.wordCount}
          coverImageUrl={document.coverImageUrl}
          coverImageAlt={document.coverImageAlt}
          onClose={() => setPreviewMode(false)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[4.75rem_minmax(0,1fr)_22.5rem] xl:grid-cols-[5.5rem_minmax(0,1fr)_24.5rem]">
          <EditorSpine json={snapshot.json} />

          <main className="min-w-0 lg:border-x lg:border-[hsl(var(--ed-rule))]">
            <ArticleEditor
              documentId={document.id}
              projectId={project.id}
              initialTitle={document.title}
              initialContentJson={document.contentJson}
              initialVersion={document.version}
              initialWordCount={document.wordCount}
              updatedAt={document.updatedAt}
              coverImageUrl={document.coverImageUrl}
              coverImageAlt={document.coverImageAlt}
              contentTypeLabel={t.editor.masthead.kicker}
              onContentSnapshot={(next) => setSnapshot(next)}
              onSaveStatusChange={setSaveStatus}
            />
          </main>

          <aside className="hidden lg:block">
            <div className="sticky top-12 flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden">{panel}</div>
          </aside>
        </div>
      )}

      <Sheet open={panelSheetOpen} onOpenChange={setPanelSheetOpen}>
        <SheetContent
          side="right"
          className="editor-surface flex w-[90vw] max-w-sm flex-col border-l border-[hsl(var(--ed-rule-strong))] bg-[hsl(var(--ed-paper))] p-0"
        >
          <SheetTitle className="sr-only">{t.editor.panelTitle}</SheetTitle>
          {panel}
        </SheetContent>
      </Sheet>
    </div>
  );
}
