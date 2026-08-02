'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, err, type ActionResult } from '@/lib/types/domain';
import { z } from 'zod';

const UpdateWorkspaceNameSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
});

export async function updateWorkspaceNameAction(
  input: z.infer<typeof UpdateWorkspaceNameSchema>,
): Promise<ActionResult<null>> {
  const parsed = UpdateWorkspaceNameSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('workspaces')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.workspaceId);

  if (error) {
    return err('UPDATE_WORKSPACE_ERROR', 'No se pudo actualizar el espacio de trabajo.');
  }

  revalidatePath('/settings/workspace');
  return ok(null);
}
