'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ArticleEditor } from './article-editor';
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
    />
  );

  return (
    // min-h asegura ocupar al menos la pantalla; la PÁGINA hace scroll (scroll
    // del navegador, no de una caja interna). La barra superior y los
    // encabezados de columna son sticky. Fondo neutro y tranquilo: el
    // protagonista es el artículo.
    <div className="-m-4 min-h-[calc(100vh-var(--app-header-h))] bg-muted/40 lg:-m-8">
      {/* Barra superior: morado sólido, texto e iconos blancos. La línea
          inferior (border-primary) es la "línea delgada morada" contra el
          contenido blanco de debajo. */}
      <div className="sticky top-0 z-40 flex h-11 items-center justify-between gap-2 border-b border-primary bg-primary px-3 text-primary-foreground shadow-sm">
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            asChild
          >
            <Link href={`/projects/${project.id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <span className="truncate text-sm font-semibold">{project.name}</span>
          <span className="ml-1 hidden sm:block">
            <SaveStatusIndicator status={saveStatus} iconOnly onColor />
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="hidden text-primary-foreground hover:bg-white/15 hover:text-primary-foreground sm:inline-flex"
            onClick={() => setPreviewMode((v) => !v)}
          >
            <Eye className="h-4 w-4" />
            {t.editor.preview.enter}
          </Button>
          <RegenerateButton
            projectId={project.id}
            currentTargetReadingMinutes={project.target_reading_minutes}
            className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
          />
          <ExportMenu
            title={document.title}
            html={snapshot.html}
            json={snapshot.json}
            className="border-white/40 bg-transparent text-primary-foreground shadow-none hover:bg-white/15 hover:text-primary-foreground"
          />
          <EmbedButton
            documentId={document.id}
            initialIsPublic={document.isPublic}
            className="border-transparent bg-white text-primary shadow-none hover:bg-white/90 hover:text-primary"
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-white/40 bg-white/15 text-primary-foreground shadow-none hover:bg-white/25 lg:hidden"
            onClick={() => setPanelSheetOpen(true)}
          >
            <PanelRight className="h-4 w-4" />
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
        <div className="mx-auto grid max-w-[1400px] gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-4">
          {/* El editor es el contenido principal. Sin overflow-hidden: rompería
              los encabezados sticky internos. Mismo tratamiento que las
              tarjetas del dashboard (componente Card): borde primario + sombra
              ligera + esquinas redondeadas. */}
          <div className="min-w-0 rounded-xl border border-primary bg-card shadow-sm">
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
          </div>

          <aside className="hidden lg:block">
            <div className="rounded-xl border border-primary bg-card shadow-sm">{panel}</div>
          </aside>
        </div>
      )}

      <Sheet open={panelSheetOpen} onOpenChange={setPanelSheetOpen}>
        <SheetContent side="right" className="w-[88vw] max-w-sm overflow-y-auto p-0">
          <SheetTitle className="sr-only">{t.editor.panelTitle}</SheetTitle>
          {panel}
        </SheetContent>
      </Sheet>
    </div>
  );
}
