'use client';

import { useMemo, useState } from 'react';
import { Copy, Search, CheckCircle2, PanelLeftClose, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { secondsToTimestamp } from '@/lib/content/metrics';
import type { TranscriptSegmentItem } from '@/lib/data/transcripts';

export function segmentDomId(segmentId: string) {
  return `transcript-segment-${segmentId}`;
}

export function TranscriptPanel({
  segments,
  usedSegmentIds,
  selectedSegmentId,
  onSelectSegment,
  collapsed = false,
  onToggleCollapsed,
}: {
  segments: TranscriptSegmentItem[];
  usedSegmentIds: Set<string>;
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return segments;
    const query = search.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(query));
  }, [segments, search]);

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Fragmento copiado');
    } catch {
      toast.error('No se pudo copiar el fragmento');
    }
  }

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex h-full flex-col items-center gap-1 py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onToggleCollapsed}>
                <FileText className="h-4 w-4" />
                <span className="sr-only">Mostrar transcripción</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Transcripción ({segments.length})</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Transcripción</h2>
          {onToggleCollapsed && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onToggleCollapsed}>
              <PanelLeftClose className="h-4 w-4" />
              <span className="sr-only">Colapsar panel</span>
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar en la transcripción..."
            className="h-8 pl-8 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        {filtered.map((segment) => {
          const isUsed = usedSegmentIds.has(segment.id);
          const isSelected = selectedSegmentId === segment.id;
          return (
            <div
              key={segment.id}
              id={segmentDomId(segment.id)}
              onClick={() => onSelectSegment(segment.id)}
              className={cn(
                'group cursor-pointer rounded-md border border-transparent p-2 text-sm transition-colors hover:bg-accent',
                isSelected && 'border-primary bg-primary/5',
              )}
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">#{segment.index + 1}</span>
                {segment.startSeconds !== null && <span>{secondsToTimestamp(segment.startSeconds)}</span>}
                {isUsed && (
                  <span className="ml-auto flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Usado
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleCopy(segment.text);
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className={cn('text-foreground', !isUsed && 'text-muted-foreground')}>
                {segment.speaker && <span className="font-medium">{segment.speaker}: </span>}
                {segment.text}
              </p>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-4 text-center text-xs text-muted-foreground">
            Sin resultados para &quot;{search}&quot;
          </p>
        )}
      </div>
    </div>
  );
}
