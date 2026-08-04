import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/types/database';

export interface ContentDocumentRecord {
  id: string;
  projectId: string;
  title: string;
  excerpt: string | null;
  contentJson: Json;
  contentHtml: string;
  contentMarkdown: string;
  status: string;
  wordCount: number;
  readingTimeMinutes: number;
  version: number;
  isPublic: boolean;
  updatedAt: string;
}

export async function getDocumentByProject(projectId: string): Promise<ContentDocumentRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('content_documents')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    projectId: data.project_id,
    title: data.title,
    excerpt: data.excerpt,
    contentJson: data.content_json,
    contentHtml: data.content_html,
    contentMarkdown: data.content_markdown,
    status: data.status,
    wordCount: data.word_count,
    readingTimeMinutes: data.reading_time_minutes,
    version: data.version,
    isPublic: data.is_public,
    updatedAt: data.updated_at,
  };
}

export async function getSeoMetadata(documentId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('seo_metadata').select('*').eq('document_id', documentId).maybeSingle();
  return data;
}

export async function getContentWarnings(documentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('content_warnings')
    .select('id, block_id, warning_type, message, status')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  return (data ?? []).map((w) => ({
    id: w.id,
    blockId: w.block_id,
    type: w.warning_type,
    message: w.message,
    status: w.status,
  }));
}

export async function getContentSourceLinks(documentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('content_source_links')
    .select('block_id, transcript_segment_id')
    .eq('document_id', documentId);

  return data ?? [];
}
