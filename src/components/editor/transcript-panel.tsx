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
      <div className="border-b border-[hsl(var(--ed-rule))] bg-[hsl(var(--ed-paper))] p-4">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex w-full items-center justify-between font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[hsl(var(--ed-ink-soft))]"
        >
          <span>
            {t.editor.columns.transcript}
            <span className="ml-2 tabular-nums text-[hsl(var(--ed-ink-faint))]">
              {segments.length.toString().padStart(3, '0')}
            </span>
          </span>
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', collapsed && '-rotate-90')}
            aria-hidden="true"
          />
          <span className="sr-only">{collapsed ? t.editor.transcript.expand : t.editor.transcript.collapse}</span>
        </button>
        {!collapsed && (
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--ed-ink-faint))]" />
            <Input
              placeholder={t.editor.transcript.searchPlaceholder}
              className="h-8 rounded-none border-[hsl(var(--ed-rule-strong))] bg-transparent pl-8 font-mono text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="p-2">
          {filtered.map((segment) => {
            const isUsed = usedSegmentIds.has(segment.id);
            const isSelected = selectedSegmentId === segment.id;
            return (
              <div
                key={segment.id}
                id={segmentDomId(segment.id)}
                onClick={() => onSelectSegment(segment.id)}
                className={cn(
                  'group cursor-pointer border-l-2 border-transparent p-2.5 text-sm transition-colors hover:bg-[hsl(var(--ed-paper-sunk))]',
                  isSelected && 'border-[hsl(var(--ed-accent))] bg-[hsl(var(--ed-paper-sunk))]',
                )}
              >
                <div className="mb-1 flex items-center gap-2 font-mono text-[0.66rem] text-[hsl(var(--ed-ink-faint))]">
                  <span className="tabular-nums">{String(segment.index + 1).padStart(3, '0')}</span>
                  {segment.startSeconds !== null && <span>{secondsToTimestamp(segment.startSeconds)}</span>}
                  {isUsed && (
                    <span className="ml-auto flex items-center gap-1 text-[hsl(var(--success))]">
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
                <p className={cn('font-serif leading-relaxed', isUsed ? 'text-[hsl(var(--ed-ink))]' : 'text-[hsl(var(--ed-ink-soft))]')}>
                  {segment.speaker && <span className="font-mono text-xs uppercase tracking-wide">{segment.speaker}: </span>}
                  {segment.text}
                </p>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="p-4 text-center font-mono text-xs text-[hsl(var(--ed-ink-faint))]">
              {t.editor.transcript.noResultsFor} &quot;{search}&quot;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
