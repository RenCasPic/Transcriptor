'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ArticleEditor } from './article-editor';
import { EditorSidePanel } from './editor-side-panel';
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

  const usedSegmentIds = useMemo(
    () => new Set(sourceLinks.map((l) => l.transcript_segment_id)),
    [sourceLinks],
  );

  const seoData = {
    seoTitle: seo?.seo_title ?? document.title,
    slug: seo?.slug ?? '',
    metaDescription: seo?.meta_description ?? '',
    primaryKeyword: seo?.primary_keyword ?? project.primary_keyword ?? '',
    secondaryKeywords: seo?.secondary_keywords ?? [],
  };

  const openWarnings = warnings.filter((w) => w.status === 'open').length;

  const sidePanel = (
    <EditorSidePanel
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
    />
  );

  return (
    <div className="-m-4 flex min-h-[calc(100vh-var(--app-header-h))] flex-col lg:-m-8">
      {/* Barra de acciones — cromo de la app, pegajosa bajo el header */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="min-w-0 gap-1.5 px-2">
            <Link href={`/projects/${project.id}`}>
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">{project.name}</span>
            </Link>
          </Button>
          <span className="hidden sm:inline">
            <SaveStatusIndicator status={saveStatus} />
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="hidden gap-1.5 sm:inline-flex"
            onClick={() => setPreviewMode((v) => !v)}
          >
            <Eye className="h-4 w-4" />
            {t.editor.preview.enter}
          </Button>
          <RegenerateButton
            projectId={project.id}
            currentTargetReadingMinutes={project.target_reading_minutes}
            className="hidden gap-1.5 sm:inline-flex"
          />
          <ExportMenu
            title={document.title}
            html={snapshot.html}
            json={snapshot.json}
            className="hidden gap-1.5 sm:inline-flex"
          />
          <EmbedButton documentId={document.id} initialIsPublic={document.isPublic} />
          <Button
            variant="outline"
            size="icon"
            className="relative lg:hidden"
            onClick={() => setPanelSheetOpen(true)}
            aria-label={t.editor.panelTitle}
          >
            <PanelRight className="h-4 w-4" />
            {openWarnings > 0 && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </Button>
        </div>
      </div>

      {previewMode ? (
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8">
          <EditorPreview
            title={document.title}
            html={snapshot.html}
            wordCount={snapshot.wordCount}
            coverImageUrl={document.coverImageUrl}
            coverImageAlt={document.coverImageAlt}
            onClose={() => setPreviewMode(false)}
          />
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
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
            onContentSnapshot={(next) => setSnapshot(next)}
            onSaveStatusChange={setSaveStatus}
          />

          <aside className="hidden lg:block">
            <div className="sticky top-[4.5rem] h-[calc(100vh-6.5rem)]">{sidePanel}</div>
          </aside>
        </div>
      )}

      <Sheet open={panelSheetOpen} onOpenChange={setPanelSheetOpen}>
        <SheetContent side="right" className="flex w-[92vw] max-w-sm flex-col p-0">
          <SheetTitle className="sr-only">{t.editor.panelTitle}</SheetTitle>
          <div className="min-h-0 flex-1 p-3">{sidePanel}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
