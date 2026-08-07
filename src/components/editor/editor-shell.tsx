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
    // Ya NO se fija a 100vh: min-h asegura que ocupe al menos la pantalla,
    // pero puede crecer más allá y la página completa hace scroll (scroll
    // del navegador, no de una caja interna). La barra superior y los
    // encabezados de cada columna son sticky para seguir visibles.
    <div className="-m-4 min-h-[calc(100vh-var(--app-header-h))] bg-gradient-to-br from-indigo-100 via-violet-50 to-amber-50 dark:from-indigo-950/30 dark:via-violet-950/20 dark:to-amber-950/20 lg:-m-8">
      <div className="sticky top-0 z-40 flex h-11 items-center justify-between border-b bg-background/95 px-3 shadow-sm backdrop-blur">
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
        Transcripción y SEO se apilan a la derecha (~31%). row-span-2 en
        Publicación + ser el PRIMER hijo en el DOM la coloca ocupando ambas
        filas de la columna 1; Transcripción y SEO caen en la columna 2,
        fila 1 y fila 2. Si reordenas estos tres bloques en el JSX, cambia
        dónde cae cada panel.
        Cada panel (ArticleEditor, TranscriptPanel, EditorDrawerTabs) trae su
        propio encabezado "sticky top-11" por dentro (11 = altura de la barra
        superior de arriba, en unidades Tailwind), así queda pegado justo
        debajo sin superponerse. Ya no hay overflow-hidden/min-h-0/flex-1 en
        este nivel: el alto real ahora lo decide el contenido, y si supera la
        pantalla, se hace scroll de la página completa.
      */}
      <div className="grid gap-4 p-3 lg:grid-cols-[minmax(560px,2.2fr)_minmax(280px,1fr)] lg:grid-rows-2">
        {/* Sin overflow-hidden aquí: rompería los encabezados sticky de abajo
            (sticky necesita que ningún ancestro recorte/scrollee por su
            cuenta). El redondeado lo aportan los propios hijos (rounded-t-2xl
            en su encabezado; el fondo del contenido ya coincide con el de
            esta tarjeta, así que no hace falta recortar nada abajo). */}
        <div className="rounded-2xl bg-background shadow-2xl ring-1 ring-black/5 lg:row-span-2">
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

        <div className="hidden rounded-2xl bg-background shadow-lg ring-1 ring-black/5 lg:block">
          <TranscriptPanel
            segments={segments}
            usedSegmentIds={usedSegmentIds}
            selectedSegmentId={selectedSegmentId}
            onSelectSegment={setSelectedSegmentId}
          />
        </div>

        <div className="hidden rounded-2xl bg-background shadow-lg ring-1 ring-black/5 lg:block">
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
