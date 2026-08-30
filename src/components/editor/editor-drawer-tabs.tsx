'use client';

import { useState } from 'react';
import { List, Search, AlertTriangle, FileText, History } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
    { value: 'outline', label: t.editor.tabs.outline, Icon: List },
    { value: 'seo', label: t.editor.tabs.seo, Icon: Search },
    { value: 'alerts', label: t.editor.tabs.alerts, Icon: AlertTriangle },
    { value: 'transcript', label: t.editor.tabs.transcript, Icon: FileText },
    { value: 'history', label: t.editor.tabs.history, Icon: History },
  ] as const;

  function goToSegment(segmentId: string) {
    onSelectSegment(segmentId);
    setTab('transcript');
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 rounded-t-xl border-b border-primary bg-background px-4 pt-4">
        <p className="mb-3 text-center text-[15px] font-semibold uppercase tracking-wide text-primary">
          {t.editor.panelTitle}
        </p>
        <TooltipProvider delayDuration={200}>
          <TabsList className="grid h-auto w-full grid-cols-5 gap-0 rounded-none border-b border-primary bg-transparent p-0">
            {TABS.map(({ value, label, Icon }) => (
              <Tooltip key={value}>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value={value}
                    aria-label={label}
                    className="relative -mb-px rounded-none border-b-2 border-transparent bg-transparent px-1 pb-2.5 pt-1.5 text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {value === 'alerts' && openWarnings > 0 && (
                      <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-medium text-warning-foreground">
                        {openWarnings}
                      </span>
                    )}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </TabsList>
        </TooltipProvider>
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
