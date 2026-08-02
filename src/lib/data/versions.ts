import { createClient } from '@/lib/supabase/server';

export interface DocumentVersionItem {
  id: string;
  versionNumber: number;
  title: string;
  contentHtml: string;
  reason: string;
  createdAt: string;
  createdBy: string | null;
}

export async function getDocumentVersions(documentId: string): Promise<DocumentVersionItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('document_versions')
    .select('id, version_number, title, content_html, reason, created_at, created_by')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false });

  return (data ?? []).map((v) => ({
    id: v.id,
    versionNumber: v.version_number,
    title: v.title,
    contentHtml: v.content_html,
    reason: v.reason,
    createdAt: v.created_at,
    createdBy: v.created_by,
  }));
}
