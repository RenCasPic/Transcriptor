'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';
import { getDomainLabels } from '@/lib/i18n/domain-labels';
import type { ProjectStatus } from '@/lib/types/database';

export function DashboardFilters({ initialSearch, initialStatus }: { initialSearch: string; initialStatus: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useDictionary();
  const locale = useLocale();
  const projectStatusLabels = getDomainLabels(locale).projectStatus;
  const STATUS_OPTIONS: Array<{ value: ProjectStatus | 'all'; label: string }> = [
    { value: 'all', label: t.dashboard.allStatuses },
    ...(Object.keys(projectStatusLabels) as ProjectStatus[]).map((status) => ({
      value: status,
      label: projectStatusLabels[status],
    })),
  ];
  const [search, setSearch] = useState(initialSearch);
  const [, startTransition] = useTransition();

  function updateParams(next: { q?: string; status?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q);
      else params.delete('q');
    }
    if (next.status !== undefined) {
      if (next.status && next.status !== 'all') params.set('status', next.status);
      else params.delete('status');
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t.dashboard.searchPlaceholder}
          className="pl-9"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            updateParams({ q: e.target.value });
          }}
        />
      </div>
      <Select defaultValue={initialStatus} onValueChange={(value) => updateParams({ status: value })}>
        <SelectTrigger className="sm:w-56">
          <SelectValue placeholder={t.dashboard.filterByStatus} />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
