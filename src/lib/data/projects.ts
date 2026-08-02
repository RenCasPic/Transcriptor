import { createClient } from '@/lib/supabase/server';
import type { ProjectStatus } from '@/lib/types/database';

export interface ProjectListItem {
  id: string;
  name: string;
  provisionalTitle: string | null;
  status: ProjectStatus;
  updatedAt: string;
  wordCount: number;
  documentStatus: string | null;
}

export interface ListProjectsOptions {
  search?: string;
  status?: ProjectStatus | 'all';
}

export async function listProjects(
  workspaceId: string,
  options: ListProjectsOptions = {},
): Promise<ProjectListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from('projects')
    .select('id, name, provisional_title, status, updated_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

  if (options.search) {
    query = query.ilike('name', `%${options.search}%`);
  }

  if (options.status && options.status !== 'all') {
    query = query.eq('status', options.status);
  }

  const { data: projects, error } = await query;
  if (error || !projects) return [];

  const projectIds = projects.map((p) => p.id);
  const documentsByProject = new Map<string, { word_count: number; status: string }>();

  if (projectIds.length > 0) {
    const { data: documents } = await supabase
      .from('content_documents')
      .select('project_id, word_count, status')
      .in('project_id', projectIds);

    documents?.forEach((doc) => {
      documentsByProject.set(doc.project_id, { word_count: doc.word_count, status: doc.status });
    });
  }

  return projects.map((project) => {
    const doc = documentsByProject.get(project.id);
    return {
      id: project.id,
      name: project.name,
      provisionalTitle: project.provisional_title,
      status: project.status,
      updatedAt: project.updated_at,
      wordCount: doc?.word_count ?? 0,
      documentStatus: doc?.status ?? null,
    };
  });
}

export async function getProjectById(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
  if (error) return null;
  return data;
}
