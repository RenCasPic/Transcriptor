'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createVersionAction } from '@/lib/actions/versions';

export function CreateVersionDialog({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) return;
    setIsSubmitting(true);
    const result = await createVersionAction({ documentId, reason: reason.trim() });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    toast.success('Versión creada');
    setReason('');
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full">
          <Plus className="h-3.5 w-3.5" />
          Crear versión manual
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear versión manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="version-reason">Motivo</Label>
          <Input
            id="version-reason"
            placeholder="Ej. Revisión editorial antes de publicar"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting || !reason.trim()}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar versión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
