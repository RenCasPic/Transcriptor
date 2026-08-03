import { createClient } from '@/lib/supabase/server';

export async function getProjectById(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
  if (error) return null;
  return data;
}
