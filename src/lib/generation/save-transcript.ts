import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

export interface SegmentToSave {
  index: number;
  speaker: string | null;
  startSeconds: number | null;
  endSeconds: number | null;
  text: string;
}

export interface SaveTranscriptParams {
  projectId: string;
  sourceId: string;
  language: string;
  fullText: string;
  segments: SegmentToSave[];
}

/**
 * Persiste una transcripción normalizada (texto o resultado de un proveedor
 * de transcripción de audio/video) como filas `transcripts` + `transcript_segments`.
 * Compartido entre la importación de texto y la transcripción real de medios
 * para no duplicar la lógica de guardado.
 */
export async function saveTranscript(
  supabase: SupabaseClient<Database>,
  params: SaveTranscriptParams,
): Promise<{ transcriptId: string } | { error: string }> {
  if (params.segments.length === 0) {
    return { error: 'EMPTY_TRANSCRIPT' };
  }

  const { data: transcript, error: transcriptError } = await supabase
    .from('transcripts')
    .insert({
      project_id: params.projectId,
      source_id: params.sourceId,
      language: params.language,
      full_text: params.fullText,
      status: 'ready',
    })
    .select('id')
    .single();

  if (transcriptError || !transcript) {
    return { error: 'CREATE_TRANSCRIPT_ERROR' };
  }

  const { error: segmentsError } = await supabase.from('transcript_segments').insert(
    params.segments.map((segment) => ({
      transcript_id: transcript.id,
      segment_index: segment.index,
      speaker: segment.speaker,
      start_seconds: segment.startSeconds,
      end_seconds: segment.endSeconds,
      text: segment.text,
    })),
  );

  if (segmentsError) {
    return { error: 'CREATE_SEGMENTS_ERROR' };
  }

  return { transcriptId: transcript.id };
}
