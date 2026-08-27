'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { ImportErrorPanel } from '@/components/dashboard/import-error-panel';
import { getJobStatusAction } from '@/lib/actions/jobs';
import type { TranscriptionJobStatus } from '@/lib/data/jobs';
import type { UploadPhase } from '@/lib/media/use-media-upload';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

const POLL_INTERVAL_MS = 2500;

type ClientPhase =
  | 'loading_converter'
  | 'extracting'
  | 'uploading'
  | 'queued'
  | 'preparing'
  | 'downloading'
  | 'chunking'
  | 'transcribing'
  | 'generating'
  | 'completed'
  | 'error';

export function MediaProcessingStatus({
  jobId,
  projectId,
  uploadProgress,
  clientPhase,
  initialStatus,
  onDismiss,
}: {
  jobId: string | null;
  projectId: string;
  /** 0-100 durante las fases de cliente (extracción/subida), antes de que exista el job. */
  uploadProgress?: number;
  /** Fase del hook useMediaUpload mientras el job aún no existe. */
  clientPhase?: UploadPhase;
  initialStatus?: TranscriptionJobStatus | null;
  onDismiss?: () => void;
}) {
  const router = useRouter();
  const t = useDictionary();
  const [status, setStatus] = useState<TranscriptionJobStatus | null>(initialStatus ?? null);
  const [pollError, setPollError] = useState(false);
  const doneRef = useRef(false);

  const poll = useCallback(async () => {
    if (!jobId) return;
    const result = await getJobStatusAction({ jobId });
    if (result.success) {
      setStatus(result.data);
      setPollError(false);
    } else {
      setPollError(true);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    if (status?.status === 'completed' || status?.status === 'failed') return;
    void poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [jobId, poll, status?.status]);

  useEffect(() => {
    if (status?.status !== 'completed' || doneRef.current) return;
    doneRef.current = true;
    const timer = setTimeout(() => {
      if (status.documentId) {
        router.push(`/projects/${projectId}/editor`);
      } else {
        router.refresh();
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [status, projectId, router]);

  const phase = resolvePhase({ clientPhase, status });
  const mp = t.projects.source.mediaProcessing;

  if (phase === 'error') {
    const code = status?.errorCode ?? 'JOB_FAILED';
    const message =
      (t.projects.source.mediaErrors as Record<string, string>)[code] ?? t.projects.source.mediaErrors.default;
    return (
      <ImportErrorPanel
        title={mp.errorTitle}
        message={message}
        dismissLabel={t.dashboard.importError.dismiss}
        onDismiss={onDismiss ?? (() => router.refresh())}
        tips={[mp.errorTip1, mp.errorTip2]}
      />
    );
  }

  const isClientPhase = phase === 'loading_converter' || phase === 'extracting' || phase === 'uploading';
  // La descarga del core no da un % fiable: se muestra indeterminado.
  const indeterminate = phase === 'loading_converter';
  const pct = isClientPhase ? (uploadProgress ?? 0) : status?.progress ?? 5;
  const clampedPct = Math.min(100, Math.max(0, Math.round(pct)));
  const label = mp[phase];

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        {phase === 'completed' ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        <span>{label}</span>
        {!indeterminate && <span className="ml-auto text-xs text-muted-foreground">{clampedPct}%</span>}
      </div>
      {!indeterminate && <Progress value={clampedPct} />}
      <p className="text-xs text-muted-foreground">
        {phase === 'completed' ? mp.completedHint : pollError ? mp.pollRetry : mp.leaveHint}
      </p>
    </div>
  );
}

function resolvePhase({
  clientPhase,
  status,
}: {
  clientPhase?: UploadPhase;
  status: TranscriptionJobStatus | null;
}): ClientPhase {
  if (clientPhase && clientPhase !== 'done' && clientPhase !== 'idle') {
    if (clientPhase === 'loading_converter') return 'loading_converter';
    if (clientPhase === 'extracting') return 'extracting';
    if (clientPhase === 'error') return 'error';
    return 'uploading'; // preparing | uploading | enqueuing
  }
  if (!status) return 'queued';
  if (status.status === 'failed') return 'error';
  if (status.status === 'completed') return 'completed';
  if (status.status === 'queued') return 'queued';
  const stage = status.stage;
  if (stage === 'chunking') return 'chunking';
  if (stage === 'downloading') return 'downloading';
  if (stage === 'transcribing') return 'transcribing';
  if (stage === 'generating') return 'generating';
  return 'preparing';
}
