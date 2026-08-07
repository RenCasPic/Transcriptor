'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Copy, Search, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { secondsToTimestamp } from '@/lib/content/metrics';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { TranscriptSegmentItem } from '@/lib/data/transcripts';

export function segmentDomId(segmentId: string) {
  return `transcript-segment-${segmentId}`;
}

export function TranscriptPanel({
  segments,
  usedSegmentIds,
  selectedSegmentId,
  onSelectSegment,
}: {
  segments: TranscriptSegmentItem[];
  usedSegmentIds: Set<string>;
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string) => void;
}) {
  const t = useDictionary();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return segments;
    const query = search.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(query));
  }, [segments, search]);

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t.editor.transcript.copyFragment);
    } catch {
      toast.error(t.editor.transcript.copyError);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="sticky top-11 z-20 bg-background">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-t-2xl bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wide text-primary-foreground"
        >
          <span className="w-4" aria-hidden="true" />
          <span>{t.editor.columns.transcript}</span>
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', collapsed && '-rotate-90')}
            aria-hidden="true"
          />
          <span className="sr-only">{collapsed ? t.editor.transcript.expand : t.editor.transcript.collapse}</span>
        </button>
        {!collapsed && (
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t.editor.transcript.searchPlaceholder}
                className="h-8 pl-8 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="space-y-1 p-3">
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
                      {t.editor.transcript.used}
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
              {t.editor.transcript.noResultsFor} &quot;{search}&quot;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
