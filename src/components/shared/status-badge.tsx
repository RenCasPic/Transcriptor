'use client';

import { Badge } from '@/components/ui/badge';
import type { ProjectStatus } from '@/lib/types/domain';
import { useLocale } from '@/lib/i18n/dictionary-provider';
import { getDomainLabels } from '@/lib/i18n/domain-labels';

const STATUS_VARIANT: Record<ProjectStatus, 'secondary' | 'warning' | 'success' | 'destructive' | 'outline'> = {
  draft: 'outline',
  processing: 'warning',
  review: 'secondary',
  ready: 'success',
  published: 'success',
  failed: 'destructive',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const locale = useLocale();
  return <Badge variant={STATUS_VARIANT[status]}>{getDomainLabels(locale).projectStatus[status]}</Badge>;
}
