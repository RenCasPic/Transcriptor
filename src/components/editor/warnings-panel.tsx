'use client';

import { useState } from 'react';
import { AlertTriangle, Eye, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { resolveWarningAction } from '@/lib/actions/editor';
import { WARNING_TYPE_LABELS, WARNING_STATUS_LABELS } from '@/lib/types/domain';
import type { WarningStatus, WarningType } from '@/lib/types/database';
import { segmentDomId } from './transcript-panel';

export interface WarningItem {
  id: string;
  blockId: string | null;
  type: WarningType;
  message: string;
  status: WarningStatus;
}

const STATUS_VARIANT: Record<WarningStatus, 'outline' | 'warning' | 'success' | 'secondary'> = {
  open: 'warning',
  reviewed: 'secondary',
  resolved: 'success',
  dismissed: 'outline',
};

export function WarningsPanel({
  warnings,
  sourceLinksByBlock,
  onNavigateToSegment,
}: {
  warnings: WarningItem[];
  sourceLinksByBlock: Map<string, string[]>;
  onNavigateToSegment: (segmentId: string) => void;
}) {
  const [items, setItems] = useState(warnings);

  async function updateStatus(id: string, status: WarningStatus) {
    setItems((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
    const result = await resolveWarningAction({ warningId: id, status });
    if (!result.success) {
      toast.error(result.error.message);
    }
  }

  function handleViewSource(blockId: string | null) {
    if (!blockId) return;
    const el = document.querySelector(`[data-block-id="${blockId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.classList.add('ring-2', 'ring-primary');
    setTimeout(() => el?.classList.remove('ring-2', 'ring-primary'), 1500);

    const segmentIds = sourceLinksByBlock.get(blockId);
    if (segmentIds && segmentIds.length > 0) {
      onNavigateToSegment(segmentIds[0]!);
      const segmentEl = document.getElementById(segmentDomId(segmentIds[0]!));
      segmentEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  if (items.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No hay alertas de fidelidad para este artículo.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-semibold">Alertas de fidelidad</h3>
      {items.map((warning) => (
        <div key={warning.id} className="space-y-2 rounded-md border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              {WARNING_TYPE_LABELS[warning.type]}
            </div>
            <Badge variant={STATUS_VARIANT[warning.status]}>{WARNING_STATUS_LABELS[warning.status]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{warning.message}</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleViewSource(warning.blockId)}>
              <Eye className="h-3 w-3" />
              Ver fuente
            </Button>
            {warning.status !== 'resolved' && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => updateStatus(warning.id, 'resolved')}
              >
                <Check className="h-3 w-3" />
                Resolver
              </Button>
            )}
            {warning.status !== 'dismissed' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => updateStatus(warning.id, 'dismissed')}
              >
                <X className="h-3 w-3" />
                Descartar
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
