import { createClient } from '@/lib/supabase/server';
import type { GenerationJobStatus } from '@/lib/types/database';
import type { TranscriptionStage } from '@/lib/generation/transcription-pipeline';

export interface TranscriptionJobStatus {
  id: string;
  status: GenerationJobStatus;
  stage: TranscriptionStage | null;
  progress: number;
  errorCode: string | null;
  transcriptId: string | null;
  documentId: string | null;
}

function toStatus(row: {
  id: string;
  status: GenerationJobStatus;
  progress: number;
  error_message: string | null;
  output: unknown;
}): TranscriptionJobStatus {
  const output = (row.output ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    status: row.status,
    stage: (output.stage as TranscriptionStage | undefined) ?? null,
    progress: typeof output.progress === 'number' ? output.progress : row.progress,
    errorCode: (output.errorCode as string | undefined) ?? row.error_message ?? null,
    transcriptId: (output.transcriptId as string | undefined) ?? null,
    documentId: (output.documentId as string | undefined) ?? null,
  };
}

/** Último job de transcripción del proyecto (lectura desde Server Component, sujeta a RLS). */
export async function getLatestTranscriptionJob(projectId: string): Promise<TranscriptionJobStatus | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('generation_jobs')
    .select('id, status, progress, error_message, output')
    .eq('project_id', projectId)
    .eq('job_type', 'transcribe')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? toStatus(data) : null;
}

export async function getTranscriptionJobById(jobId: string): Promise<TranscriptionJobStatus | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('generation_jobs')
    .select('id, status, progress, error_message, output')
    .eq('id', jobId)
    .eq('job_type', 'transcribe')
    .maybeSingle();

  return data ? toStatus(data) : null;
}
