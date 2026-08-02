'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  CreateProjectSchema,
  CONTENT_TYPES,
  ARTICLE_TONES,
  type CreateProjectInput,
} from '@/lib/validations/project';
import { CONTENT_TYPE_LABELS, ARTICLE_TONE_LABELS } from '@/lib/types/domain';
import { updateProjectAction } from '@/lib/actions/projects';
import type { Database } from '@/lib/types/database';

type ProjectRow = Database['public']['Tables']['projects']['Row'];

export function EditProjectDialog({ project }: { project: ProjectRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: {
      name: project.name,
      provisionalTitle: project.provisional_title ?? '',
      contentType: project.content_type,
      audience: project.audience ?? '',
      tone: project.tone,
      language: project.language,
      primaryKeyword: project.primary_keyword ?? '',
      objective: project.objective ?? '',
      callToAction: project.call_to_action ?? '',
    },
  });

  async function onSubmit(values: CreateProjectInput) {
    setIsSubmitting(true);
    const result = await updateProjectAction(project.id, values);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    toast.success('Proyecto actualizado');
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" />
          Editar detalles
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar proyecto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nombre del proyecto</Label>
            <Input id="edit-name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-provisionalTitle">Título provisional</Label>
            <Input id="edit-provisionalTitle" {...register('provisionalTitle')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo de contenido</Label>
              <Controller
                control={control}
                name="contentType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {CONTENT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tono</Label>
              <Controller
                control={control}
                name="tone"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ARTICLE_TONES.map((tone) => (
                        <SelectItem key={tone} value={tone}>
                          {ARTICLE_TONE_LABELS[tone]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-audience">Audiencia</Label>
            <Input id="edit-audience" {...register('audience')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-primaryKeyword">Palabra clave principal</Label>
            <Input id="edit-primaryKeyword" {...register('primaryKeyword')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-objective">Objetivo del artículo</Label>
            <Textarea id="edit-objective" {...register('objective')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-callToAction">Llamada a la acción</Label>
            <Input id="edit-callToAction" {...register('callToAction')} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
