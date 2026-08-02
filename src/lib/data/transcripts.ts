import { createClient } from '@/lib/supabase/server';

export interface TranscriptSegmentItem {
  id: string;
  index: number;
  speaker: string | null;
  startSeconds: number | null;
  endSeconds: number | null;
  text: string;
}

export interface TranscriptWithSegments {
  id: string;
  language: string;
  fullText: string;
  segments: TranscriptSegmentItem[];
  sourceId: string | null;
  hasOriginalFile: boolean;
}

export async function getLatestTranscript(projectId: string): Promise<TranscriptWithSegments | null> {
  const supabase = await createClient();

  const { data: transcript } = await supabase
    .from('transcripts')
    .select('id, language, full_text, source_id')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!transcript) return null;

  const [{ data: segments }, { data: source }] = await Promise.all([
    supabase
      .from('transcript_segments')
      .select('id, segment_index, speaker, start_seconds, end_seconds, text')
      .eq('transcript_id', transcript.id)
      .order('segment_index', { ascending: true }),
    transcript.source_id
      ? supabase.from('media_sources').select('storage_path').eq('id', transcript.source_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    id: transcript.id,
    language: transcript.language,
    fullText: transcript.full_text,
    sourceId: transcript.source_id,
    hasOriginalFile: !!source?.storage_path,
    segments: (segments ?? []).map((s) => ({
      id: s.id,
      index: s.segment_index,
      speaker: s.speaker,
      startSeconds: s.start_seconds,
      endSeconds: s.end_seconds,
      text: s.text,
    })),
  };
}
