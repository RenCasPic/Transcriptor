'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeoPanel, type SeoPanelData } from './seo-panel';
import { WarningsPanel, type WarningItem } from './warnings-panel';
import { HistoryPanel } from './history-panel';
import { ArticleOutline } from './article-outline';
import { TranscriptPanel } from './transcript-panel';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { DocumentVersionItem } from '@/lib/data/versions';
import type { TranscriptSegmentItem } from '@/lib/data/transcripts';
import type { Json } from '@/lib/types/database';

type SidePanelTab = 'outline' | 'seo' | 'alerts' | 'transcript' | 'history';

/**
 * Panel lateral del editor: pestañas estándar de la app (Índice, SEO, Alertas,
 * Fuente, Historial) dentro de una Card redondeada. Cada pestaña reutiliza su
 * panel existente sin cambios de lógica.
 */
export function EditorSidePanel({
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
  const [tab, setTab] = useState<SidePanelTab>('outline');

  function goToSegment(segmentId: string) {
    onSelectSegment(segmentId);
    setTab('transcript');
  }

  const openWarnings = warnings.filter((w) => w.status === 'open').length;

  const TABS: Array<{ id: SidePanelTab; label: string }> = [
    { id: 'outline', label: t.editor.tabs.outline },
    { id: 'seo', label: t.editor.tabs.seo },
    { id: 'alerts', label: t.editor.tabs.alerts },
    { id: 'transcript', label: t.editor.tabs.transcript },
    { id: 'history', label: t.editor.tabs.history },
  ];

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as SidePanelTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="border-b p-2">
          <TabsList className="grid h-auto w-full grid-cols-5 gap-0.5 bg-muted">
            {TABS.map((tabDef) => (
              <TabsTrigger
                key={tabDef.id}
                value={tabDef.id}
                className={cn(
                  'relative px-1 py-1.5 text-[0.7rem] font-medium',
                  'data-[state=active]:bg-background data-[state=active]:text-foreground',
                )}
              >
                {tabDef.label}
                {tabDef.id === 'alerts' && openWarnings > 0 && (
                  <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
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
            <WarningsPanel
              warnings={warnings}
              sourceLinksByBlock={sourceLinksByBlock}
              onNavigateToSegment={goToSegment}
            />
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
    </Card>
  );
}
