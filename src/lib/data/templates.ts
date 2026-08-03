import { createClient } from '@/lib/supabase/server';
import type { ContentType, ArticleTone } from '@/lib/types/database';

export interface ProjectTemplateItem {
  id: string;
  name: string;
  contentType: ContentType;
  audience: string | null;
  tone: ArticleTone;
  language: string;
  primaryKeyword: string | null;
  objective: string | null;
  callToAction: string | null;
  createdAt: string;
}

export async function listTemplates(workspaceId: string): Promise<ProjectTemplateItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('project_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    contentType: t.content_type,
    audience: t.audience,
    tone: t.tone,
    language: t.language,
    primaryKeyword: t.primary_keyword,
    objective: t.objective,
    callToAction: t.call_to_action,
    createdAt: t.created_at,
  }));
}

export async function getTemplateById(templateId: string): Promise<ProjectTemplateItem | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('project_templates').select('*').eq('id', templateId).maybeSingle();
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    contentType: data.content_type,
    audience: data.audience,
    tone: data.tone,
    language: data.language,
    primaryKeyword: data.primary_keyword,
    objective: data.objective,
    callToAction: data.call_to_action,
    createdAt: data.created_at,
  };
}
