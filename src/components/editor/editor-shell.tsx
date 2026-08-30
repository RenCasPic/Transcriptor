'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, PanelRightOpen } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ArticleEditor } from './article-editor';
import { EditorScale } from './editor-scale';
import { EditorRegistration } from './editor-registration';
import { EditorConsole, type EditorMode } from './editor-console';
import { EditorPreview } from './editor-preview';
import { RegenerateButton } from './regenerate-button';
import { SaveStatusIndicator } from './save-status-indicator';
import { ExportMenu } from './export-menu';
import { EmbedButton } from './embed-button';
import { useEditorScroll } from '@/lib/editor/use-editor-scroll';
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
  const scroll = useEditorScroll();
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [panelSheetOpen, setPanelSheetOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [mode, setMode] = useState<EditorMode>('structure');
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
  const modeLabel = t.editor.console[mode];

  const consoleEl = (
    <EditorConsole
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
      onModeChange={setMode}
    />
  );

  const link = 'font-mono text-[0.66rem] uppercase tracking-[0.12em] text-[hsl(var(--ed-desk-ink-dim))] transition-colors hover:text-[hsl(var(--ed-desk-ink))]';

  return (
    <div
      data-mode={mode}
      className="editor-surface -m-4 min-h-[calc(100vh-var(--app-header-h))] font-sans lg:-m-8"
    >
      {/* CINTA — casi nada en calma. Coordenada a la izquierda, maquinaria a la derecha. */}
      <div className="sticky top-0 z-40 flex h-9 items-center justify-between gap-4 border-b border-[hsl(var(--ed-desk-line))] bg-[hsl(var(--ed-desk))]/95 px-3 backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/projects/${project.id}`}
            aria-label={t.editor.actions.back}
            className="grid h-6 w-6 place-items-center text-[hsl(var(--ed-desk-ink-dim))] transition-colors hover:text-[hsl(var(--ed-desk-ink))]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <span className="ed-label text-[hsl(var(--ed-desk-ink-dim))]">{t.editor.masthead.kicker}</span>
          <span aria-hidden className="hidden h-2.5 w-px bg-[hsl(var(--ed-desk-line))] sm:block" />
          <span className="truncate font-mono text-[0.72rem] text-[hsl(var(--ed-desk-ink))]">{project.name}</span>
        </div>

        <div className="flex items-center gap-3">
          <SaveStatusIndicator status={saveStatus} />
          <button type="button" className={`hidden items-center gap-1.5 sm:inline-flex ${link}`} onClick={() => setPreviewMode((v) => !v)}>
            <Eye className="h-3.5 w-3.5" />
            {t.editor.preview.enter}
          </button>
          <RegenerateButton
            projectId={project.id}
            currentTargetReadingMinutes={project.target_reading_minutes}
            className={`hidden gap-1.5 rounded-none px-0 hover:bg-transparent sm:inline-flex ${link} hover:text-[hsl(var(--ed-desk-ink))]`}
          />
          <ExportMenu
            title={document.title}
            html={snapshot.html}
            json={snapshot.json}
            className={`hidden gap-1.5 rounded-none border-0 bg-transparent px-0 shadow-none hover:bg-transparent sm:inline-flex ${link} hover:text-[hsl(var(--ed-desk-ink))]`}
          />
          <EmbedButton
            documentId={document.id}
            initialIsPublic={document.isPublic}
            className="h-6 gap-1.5 rounded-none border border-[hsl(var(--ed-accent))] bg-transparent px-2.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-[hsl(var(--ed-accent))] shadow-none hover:bg-[hsl(var(--ed-accent))] hover:text-[hsl(var(--ed-desk))]"
          />
          <button
            type="button"
            onClick={() => setPanelSheetOpen(true)}
            aria-label={t.editor.panelTitle}
            className="relative grid h-6 w-6 place-items-center text-[hsl(var(--ed-desk-ink-dim))] lg:hidden"
          >
            <PanelRightOpen className="h-4 w-4" />
            {openWarnings > 0 && (
              <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--ed-accent))]" />
            )}
          </button>
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
        <div className="grid grid-cols-1 lg:grid-cols-[6rem_minmax(0,44rem)_1fr] xl:grid-cols-[7rem_minmax(0,46rem)_1fr]">
          <EditorScale json={snapshot.json} scroll={scroll} />

          {/* EL MANUSCRITO — objeto físico posado sobre el banco. */}
          <main className="relative min-w-0 border-x border-[hsl(var(--ed-rule-strong))] bg-[hsl(var(--ed-paper))] shadow-[10px_12px_0_-3px_hsl(var(--ed-rule))] lg:my-6 lg:border">
            <span className="ed-crop tl" aria-hidden />
            <span className="ed-crop tr" aria-hidden />
            <span className="ed-crop bl" aria-hidden />
            <span className="ed-crop br" aria-hidden />

            <EditorRegistration scroll={scroll} mode={mode} modeLabel={modeLabel} saveStatus={saveStatus} />

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

          {/* EL BANCO se ve como vacío intencionado; la consola cuelga a la derecha. */}
          <div className="hidden lg:flex lg:justify-end">
            <aside className="sticky top-9 flex h-[calc(100vh-2.25rem)] w-[21rem] flex-col overflow-hidden border-l border-[hsl(var(--ed-desk-line))]">
              {consoleEl}
            </aside>
          </div>
        </div>
      )}

      <Sheet open={panelSheetOpen} onOpenChange={setPanelSheetOpen}>
        <SheetContent
          side="right"
          className="editor-surface flex w-[92vw] max-w-sm flex-col border-l border-[hsl(var(--ed-desk-line))] bg-[hsl(var(--ed-desk-2))] p-0"
        >
          <SheetTitle className="sr-only">{t.editor.panelTitle}</SheetTitle>
          {consoleEl}
        </SheetContent>
      </Sheet>
    </div>
  );
}
