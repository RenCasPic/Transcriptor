'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateWorkspaceNameAction } from '@/lib/actions/workspace';

export function WorkspaceNameForm({
  workspaceId,
  defaultName,
  disabled,
}: {
  workspaceId: string;
  defaultName: string;
  disabled: boolean;
}) {
  const [name, setName] = useState(defaultName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await updateWorkspaceNameAction({ workspaceId, name });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Espacio de trabajo actualizado');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="workspaceName">Nombre</Label>
        <Input
          id="workspaceName"
          value={name}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {!disabled && (
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar cambios
        </Button>
      )}
    </form>
  );
}
