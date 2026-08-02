import { Badge } from '@/components/ui/badge';
import { PROJECT_STATUS_LABELS, type ProjectStatus } from '@/lib/types/domain';

const STATUS_VARIANT: Record<ProjectStatus, 'secondary' | 'warning' | 'success' | 'destructive' | 'outline'> = {
  draft: 'outline',
  processing: 'warning',
  review: 'secondary',
  ready: 'success',
  published: 'success',
  failed: 'destructive',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}
