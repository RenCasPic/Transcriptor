'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';
import { getCurrentWorkspace } from '@/lib/data/workspace';
import { CreateTemplateSchema, type CreateTemplateInput } from '@/lib/validations/template';

export async function createTemplateAction(input: CreateTemplateInput): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return err('UNAUTHENTICATED', 'Debes iniciar sesión.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err('UNAUTHENTICATED', 'Debes iniciar sesión.');
  }

  const { data, error } = await supabase
    .from('project_templates')
    .insert({
      workspace_id: workspace.id,
      created_by: user.id,
      name: parsed.data.name,
      content_type: parsed.data.contentType,
      audience: parsed.data.audience || null,
      tone: parsed.data.tone,
      language: parsed.data.language,
      primary_keyword: parsed.data.primaryKeyword || null,
      objective: parsed.data.objective || null,
      call_to_action: parsed.data.callToAction || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    return err('CREATE_TEMPLATE_ERROR', 'No se pudo guardar la plantilla.');
  }

  revalidatePath('/dashboard');
  return ok({ id: data.id });
}

export async function deleteTemplateAction(templateId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from('project_templates').delete().eq('id', templateId);

  if (error) {
    return err('DELETE_TEMPLATE_ERROR', 'No se pudo eliminar la plantilla.');
  }

  revalidatePath('/dashboard');
  return ok(null);
}
