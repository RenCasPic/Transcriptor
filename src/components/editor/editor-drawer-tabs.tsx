'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeoPanel, type SeoPanelData } from './seo-panel';
import { WarningsPanel, type WarningItem } from './warnings-panel';
import { HistoryPanel } from './history-panel';
import { ArticleOutline } from './article-outline';
import { TranscriptPanel } from './transcript-panel';
import { SaveStatusIndicator } from './save-status-indicator';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { AutosaveStatus } from '@/lib/editor/use-autosave';
import type { DocumentVersionItem } from '@/lib/data/versions';
import type { TranscriptSegmentItem } from '@/lib/data/transcripts';
import type { Json } from '@/lib/types/database';

/**
 * SALA DE CONTROL — no un sidebar de opciones, sino el tablero de instrumentos
 * del documento: estructura, SEO, alertas, fuente e historial, seleccionables
 * por un índice numerado (01–05) que comparte numeración con el folio.
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
  saveStatus,
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
  saveStatus: AutosaveStatus;
}) {
  const t = useDictionary();
  const [tab, setTab] = useState('outline');
  const openWarnings = warnings.filter((w) => w.status === 'open').length;

  function goToSegment(segmentId: string) {
    onSelectSegment(segmentId);
    setTab('transcript');
  }

  const MODULES = [
    { value: 'outline', label: t.editor.tabs.outline },
    { value: 'seo', label: t.editor.tabs.seo },
    { value: 'alerts', label: t.editor.tabs.alerts },
    { value: 'transcript', label: t.editor.tabs.transcript },
    { value: 'history', label: t.editor.tabs.history },
  ] as const;

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col bg-[hsl(var(--ed-paper))] font-sans">
      <div className="shrink-0 border-b border-[hsl(var(--ed-rule-strong))] bg-[hsl(var(--ed-paper))] px-4 pt-4">
        <div className="flex items-baseline justify-between">
          <p className="ed-label">{t.editor.panelTitle}</p>
          <SaveStatusIndicator status={saveStatus} />
        </div>

        <TabsList className="mt-3.5 grid h-auto w-full grid-cols-5 gap-0 rounded-none bg-transparent p-0">
          {MODULES.map(({ value, label }, i) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                'group relative flex h-auto flex-col items-start gap-1 rounded-none border-t-2 border-transparent bg-transparent px-1 pb-2.5 pt-2 text-left shadow-none transition-colors',
                'data-[state=active]:border-[hsl(var(--ed-accent))] data-[state=active]:bg-transparent data-[state=active]:shadow-none',
              )}
            >
              <span className="font-mono text-[0.7rem] tabular-nums text-[hsl(var(--ed-ink-faint))] group-data-[state=active]:text-[hsl(var(--ed-accent))]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-[hsl(var(--ed-ink-faint))] group-hover:text-[hsl(var(--ed-ink-soft))] group-data-[state=active]:text-[hsl(var(--ed-ink))]">
                {label}
                {value === 'alerts' && openWarnings > 0 && (
                  <span className="grid h-3.5 min-w-3.5 place-items-center rounded-full bg-[hsl(var(--warning))] px-0.5 text-[0.6rem] font-bold text-[hsl(var(--warning-foreground))]">
                    {openWarnings}
                  </span>
                )}
              </span>
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
