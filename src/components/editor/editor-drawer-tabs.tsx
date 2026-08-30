'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeoPanel, type SeoPanelData } from './seo-panel';
import { WarningsPanel, type WarningItem } from './warnings-panel';
import { HistoryPanel } from './history-panel';
import { ArticleOutline } from './article-outline';
import { TranscriptPanel } from './transcript-panel';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { DocumentVersionItem } from '@/lib/data/versions';
import type { TranscriptSegmentItem } from '@/lib/data/transcripts';
import type { Json } from '@/lib/types/database';

/**
 * Panel de publicación: un único panel a la derecha del editor con pestañas
 * (Índice · SEO · Alertas · Fuente · Historial). El editor es el contenido
 * principal; este panel es material de apoyo. Sustituye a las dos tarjetas
 * apiladas anteriores (Transcripción + SEO) para reducir "cajas dentro de
 * cajas". Mantiene su encabezado `sticky` propio justo debajo de la barra
 * superior del EditorShell.
 */
export function EditorDrawerTabs({
  documentId,
  projectId,
  documentTitle,
  excerpt,
  seo,
  wordCount,
  html,
  contentJson,
  warnings,
  sourceLinksByBlock,
  segments,
  usedSegmentIds,
  selectedSegmentId,
  onSelectSegment,
  versions,
  currentUserId,
}: {
  documentId: string;
  projectId: string;
  documentTitle: string;
  excerpt: string;
  seo: SeoPanelData;
  wordCount: number;
  html: string;
  contentJson: Json;
  warnings: WarningItem[];
  sourceLinksByBlock: Map<string, string[]>;
  segments: TranscriptSegmentItem[];
  usedSegmentIds: Set<string>;
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string) => void;
  versions: DocumentVersionItem[];
  currentUserId: string | null;
}) {
  const t = useDictionary();
  const [tab, setTab] = useState('outline');
  const openWarnings = warnings.filter((w) => w.status === 'open').length;

  const TABS = [
    { value: 'outline', label: t.editor.tabs.outline },
    { value: 'seo', label: t.editor.tabs.seo },
    { value: 'alerts', label: t.editor.tabs.alerts },
    { value: 'transcript', label: t.editor.tabs.transcript },
    { value: 'history', label: t.editor.tabs.history },
  ] as const;

  function goToSegment(segmentId: string) {
    onSelectSegment(segmentId);
    setTab('transcript');
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex flex-col">
      <div className="sticky top-11 z-20 rounded-t-xl border-b border-border bg-background/95 px-4 pt-4 backdrop-blur">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">{t.editor.panelTitle}</p>
        <TabsList className="grid h-auto w-full grid-cols-5 gap-0 rounded-none border-b border-border bg-transparent p-0">
          {TABS.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="-mb-px rounded-none border-b-2 border-transparent bg-transparent px-1 pb-2 pt-1 text-[13px] font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {label}
              {value === 'alerts' && openWarnings > 0 && (
                <span className="ml-1 rounded-full bg-warning px-1 text-[11px] text-warning-foreground">
                  {openWarnings}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <div>
        <TabsContent value="outline" className="mt-0">
          <ArticleOutline json={contentJson} />
        </TabsContent>
        <TabsContent value="seo" className="mt-0">
          <SeoPanel
            documentId={documentId}
            documentTitle={documentTitle}
            initialExcerpt={excerpt}
            initialSeo={seo}
            wordCount={wordCount}
            html={html}
          />
        </TabsContent>
        <TabsContent value="alerts" className="mt-0">
          <WarningsPanel warnings={warnings} sourceLinksByBlock={sourceLinksByBlock} onNavigateToSegment={goToSegment} />
        </TabsContent>
        <TabsContent value="transcript" className="mt-0">
          <TranscriptPanel
            segments={segments}
            usedSegmentIds={usedSegmentIds}
            selectedSegmentId={selectedSegmentId}
            onSelectSegment={onSelectSegment}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-0">
          <HistoryPanel
            documentId={documentId}
            projectId={projectId}
            currentTitle={documentTitle}
            currentHtml={html}
            versions={versions}
            currentUserId={currentUserId}
          />
        </TabsContent>
      </div>
    </Tabs>
  );
}
