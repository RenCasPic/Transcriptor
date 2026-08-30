'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeoPanel, type SeoPanelData } from './seo-panel';
import { WarningsPanel, type WarningItem } from './warnings-panel';
import { HistoryPanel } from './history-panel';
import { ArticleOutline } from './article-outline';
import { TranscriptPanel } from './transcript-panel';
import { SaveStatusIndicator } from './save-status-indicator';
import { cn } from '@/lib/utils';
import { extractHeadings } from '@/lib/editor/headings';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { AutosaveStatus } from '@/lib/editor/use-autosave';
import type { DocumentVersionItem } from '@/lib/data/versions';
import type { TranscriptSegmentItem } from '@/lib/data/transcripts';
import type { Json } from '@/lib/types/database';

export type EditorMode = 'structure' | 'discovery' | 'integrity' | 'origin' | 'memory';

/**
 * LA CONSOLA — no un sidebar: el tablero del proceso editorial. Cinco
 * estaciones (estructura → memoria), cada una con su "carga" visible como
 * barra. Elegir una cambia el MODO OPERATIVO de todo el instrumento (la
 * superficie reacciona vía `data-mode`).
 */
export function EditorConsole({
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
  onModeChange,
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
  onModeChange?: (mode: EditorMode) => void;
}) {
  const t = useDictionary();
  const [mode, setMode] = useState<EditorMode>('structure');

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  function goToSegment(segmentId: string) {
    onSelectSegment(segmentId);
    setMode('origin');
  }

  const openWarnings = warnings.filter((w) => w.status === 'open').length;
  const headings = extractHeadings(contentJson).filter((h) => h.level === 2).length;
  const usedRatio = segments.length ? usedSegmentIds.size / segments.length : 0;

  // "Carga" de cada estación, 0–1, para la barra.
  const STATIONS: Array<{ id: EditorMode; label: string; load: number; readout: string }> = [
    { id: 'structure', label: t.editor.console.structure, load: clamp(headings / 12), readout: String(headings).padStart(2, '0') },
    { id: 'discovery', label: t.editor.console.discovery, load: clamp(wordCount / 1600), readout: `${Math.round(clamp(wordCount / 1600) * 100)}` },
    { id: 'integrity', label: t.editor.console.integrity, load: openWarnings ? clamp(openWarnings / 6) : 0, readout: String(openWarnings).padStart(2, '0') },
    { id: 'origin', label: t.editor.console.origin, load: usedRatio, readout: `${Math.round(usedRatio * 100)}` },
    { id: 'memory', label: t.editor.console.memory, load: clamp(versions.length / 10), readout: String(versions.length).padStart(2, '0') },
  ];

  return (
    <Tabs
      value={mode}
      onValueChange={(v) => setMode(v as EditorMode)}
      className="flex min-h-0 flex-1 flex-col bg-[hsl(var(--ed-desk-2))] font-sans text-[hsl(var(--ed-desk-ink))]"
    >
      {/* CHASIS — selector de estaciones, en grafito */}
      <div className="shrink-0 border-b border-[hsl(var(--ed-desk-line))] px-4 pb-3 pt-5">
        <div className="flex items-baseline justify-between">
          <span className="ed-label text-[hsl(var(--ed-desk-ink))]">{t.editor.panelTitle}</span>
          <SaveStatusIndicator status={saveStatus} />
        </div>

        <TabsList className="mt-4 flex h-auto w-full flex-col gap-0 rounded-none bg-transparent p-0">
          {STATIONS.map((s, i) => {
            const on = s.id === mode;
            return (
              <TabsTrigger
                key={s.id}
                value={s.id}
                className={cn(
                  'group/st flex h-auto w-full flex-col items-stretch gap-1.5 rounded-none border-l-2 border-transparent bg-transparent px-3 py-2 text-left shadow-none transition-colors',
                  'data-[state=active]:border-[hsl(var(--ed-accent))] data-[state=active]:bg-[hsl(var(--ed-desk-3))] data-[state=active]:shadow-none',
                )}
              >
                <span className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      'font-mono text-[0.7rem] tabular-nums',
                      on ? 'text-[hsl(var(--ed-accent))]' : 'text-[hsl(var(--ed-desk-ink-dim))]',
                    )}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={cn(
                      'flex-1 font-mono text-[0.66rem] uppercase tracking-[0.14em]',
                      on ? 'text-[hsl(var(--ed-desk-ink))]' : 'text-[hsl(var(--ed-desk-ink-dim))] group-hover/st:text-[hsl(var(--ed-desk-ink))]',
                    )}
                  >
                    {s.label}
                  </span>
                  <span className="font-mono text-[0.62rem] tabular-nums text-[hsl(var(--ed-desk-ink-dim))]">
                    {s.readout}
                    {s.id === 'integrity' && openWarnings > 0 && (
                      <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--ed-accent))] align-middle" />
                    )}
                  </span>
                </span>
                <span className="h-[3px] w-full bg-[hsl(var(--ed-desk-line))]">
                  <span
                    className={cn('block h-full', on ? 'bg-[hsl(var(--ed-accent))]' : 'bg-[hsl(var(--ed-desk-ink-dim))]')}
                    style={{ width: `${Math.max(4, s.load * 100)}%` }}
                  />
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {/* PANTALLA — la lectura de la estación activa, en papel */}
      <div
        key={mode}
        className="ed-mode-sweep min-h-0 flex-1 overflow-y-auto bg-[hsl(var(--ed-paper))] text-[hsl(var(--ed-ink))]"
      >
        <TabsContent value="structure" className="mt-0">
          <ArticleOutline json={contentJson} />
        </TabsContent>
        <TabsContent value="discovery" className="mt-0">
          <SeoPanel
            documentId={documentId}
            documentTitle={documentTitle}
            initialExcerpt={excerpt}
            initialSeo={seo}
            wordCount={wordCount}
            html={html}
          />
        </TabsContent>
        <TabsContent value="integrity" className="mt-0">
          <WarningsPanel warnings={warnings} sourceLinksByBlock={sourceLinksByBlock} onNavigateToSegment={goToSegment} />
        </TabsContent>
        <TabsContent value="origin" className="mt-0">
          <TranscriptPanel
            segments={segments}
            usedSegmentIds={usedSegmentIds}
            selectedSegmentId={selectedSegmentId}
            onSelectSegment={onSelectSegment}
          />
        </TabsContent>
        <TabsContent value="memory" className="mt-0">
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

function clamp(n: number) {
  return Math.max(0, Math.min(1, n));
}
