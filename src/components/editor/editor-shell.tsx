'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { TranscriptPanel } from './transcript-panel';
import { ArticleEditor } from './article-editor';
import { EditorDrawerTabs } from './editor-drawer-tabs';
import { ExportMenu } from './export-menu';
import { EmbedButton } from './embed-button';
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
  const [transcriptSheetOpen, setTranscriptSheetOpen] = useState(false);
  const [drawerSheetOpen, setDrawerSheetOpen] = useState(false);
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

  return (
    <div className="-m-4 flex h-[calc(100vh-var(--app-header-h))] flex-col bg-gradient-to-br from-indigo-100 via-violet-50 to-amber-50 dark:from-indigo-950/30 dark:via-violet-950/20 dark:to-amber-950/20 lg:-m-8">
      <div className="flex items-center justify-between border-b bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${project.id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <span className="truncate text-sm font-medium">{project.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setTranscriptSheetOpen(true)}>
            <FileText className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setDrawerSheetOpen(true)}>
            <PanelRight className="h-4 w-4" />
          </Button>
          <EmbedButton documentId={document.id} initialIsPublic={document.isPublic} />
          <ExportMenu title={document.title} html={snapshot.html} json={snapshot.json} />
        </div>
      </div>

      {/*
        Layout: Publicación ocupa toda la altura a la izquierda (~69%);
        Transcripción y SEO se apilan a la derecha (~31%), cada una a la mitad
        de esa altura. Se logra con grid-rows-2 + row-span-2 en Publicación:
        al ser el PRIMER hijo en el DOM, la colocación automática de grid lo
        pone en la columna 1 ocupando ambas filas; los siguientes dos hijos
        (Transcripción, SEO) caen en la columna 2, fila 1 y fila 2 en ese
        orden. Si reordenas estos tres divs en el JSX, cambia dónde cae cada
        panel — por eso Publicación va primero.
        minmax(): igual que antes, evita que la columna derecha se vuelva
        inusable en pantallas angostas antes de pasar a una sola columna (lg).
        min-h-0: sin esto, el grid crece al alto de su contenido en vez de
        quedarse en el alto que le da flex-1, y el scroll interno se rompe.
        Publicación no lleva la barra morada de título de columna: es el
        panel principal.
      */}
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-3 lg:grid-cols-[minmax(560px,2.2fr)_minmax(280px,1fr)] lg:grid-rows-2">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-black/5 lg:row-span-2">
          <div className="shrink-0 bg-primary px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-primary-foreground">
            {t.editor.columns.publication}
          </div>
          <div className="min-h-0 flex-1">
            <ArticleEditor
              documentId={document.id}
              projectId={project.id}
              initialTitle={document.title}
              initialContentJson={document.contentJson}
              initialVersion={document.version}
              initialWordCount={document.wordCount}
              coverImageUrl={document.coverImageUrl}
              coverImageAlt={document.coverImageAlt}
              onContentSnapshot={(next) => setSnapshot(next)}
            />
          </div>
        </div>

        <div className="hidden min-h-0 flex-col overflow-hidden rounded-2xl bg-background shadow-lg ring-1 ring-black/5 lg:flex">
          <div className="shrink-0 bg-primary px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-primary-foreground">
            {t.editor.columns.transcript}
          </div>
          <div className="min-h-0 flex-1">
            <TranscriptPanel
              segments={segments}
              usedSegmentIds={usedSegmentIds}
              selectedSegmentId={selectedSegmentId}
              onSelectSegment={setSelectedSegmentId}
            />
          </div>
        </div>

        <div className="hidden min-h-0 flex-col overflow-hidden rounded-2xl bg-background shadow-lg ring-1 ring-black/5 lg:flex">
          <div className="shrink-0 bg-primary px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-primary-foreground">
            {t.editor.columns.seo}
          </div>
          <div className="min-h-0 flex-1">
            <EditorDrawerTabs
              documentId={document.id}
              projectId={project.id}
              project={project}
              documentTitle={document.title}
              excerpt={document.excerpt ?? ''}
              seo={seoData}
              wordCount={snapshot.wordCount}
              html={snapshot.html}
              warnings={warnings}
              sourceLinksByBlock={sourceLinksByBlock}
              onNavigateToSegment={setSelectedSegmentId}
              versions={versions}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      </div>

      <Sheet open={transcriptSheetOpen} onOpenChange={setTranscriptSheetOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
          <SheetTitle className="sr-only">{t.editor.columns.transcript}</SheetTitle>
          <TranscriptPanel
            segments={segments}
            usedSegmentIds={usedSegmentIds}
            selectedSegmentId={selectedSegmentId}
            onSelectSegment={(id) => {
              setSelectedSegmentId(id);
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={drawerSheetOpen} onOpenChange={setDrawerSheetOpen}>
        <SheetContent side="right" className="w-[85vw] max-w-sm p-0">
          <SheetTitle className="sr-only">{t.editor.articlePanelTitle}</SheetTitle>
          <EditorDrawerTabs
            documentId={document.id}
            projectId={project.id}
            project={project}
            documentTitle={document.title}
            excerpt={document.excerpt ?? ''}
            seo={seoData}
            wordCount={snapshot.wordCount}
            html={snapshot.html}
            warnings={warnings}
            sourceLinksByBlock={sourceLinksByBlock}
            onNavigateToSegment={setSelectedSegmentId}
            versions={versions}
            currentUserId={currentUserId}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
