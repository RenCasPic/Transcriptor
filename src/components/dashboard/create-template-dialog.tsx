'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
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
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CreateTemplateSchema, type CreateTemplateInput } from '@/lib/validations/template';
import { CONTENT_TYPES, ARTICLE_TONES } from '@/lib/validations/project';
import { CONTENT_TYPE_LABELS, ARTICLE_TONE_LABELS } from '@/lib/types/domain';
import { createTemplateAction } from '@/lib/actions/templates';

export function CreateTemplateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTemplateInput>({
    resolver: zodResolver(CreateTemplateSchema),
    defaultValues: { tone: 'professional', contentType: 'guide', language: 'es' },
  });

  async function onSubmit(values: CreateTemplateInput) {
    setIsSubmitting(true);
    const result = await createTemplateAction(values);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    toast.success('Plantilla guardada');
    reset({ tone: 'professional', contentType: 'guide', language: 'es' });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          Nueva plantilla
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva plantilla</DialogTitle>
          <DialogDescription>
            Guarda una configuración para reutilizarla al crear proyectos nuevos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Nombre de la plantilla</Label>
            <Input id="template-name" placeholder="Ej. Podcast semanal B2B" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
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
            <Label htmlFor="template-audience">Audiencia</Label>
            <Input id="template-audience" placeholder="Ej. Founders de startups B2B" {...register('audience')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-keyword">Palabra clave principal (opcional)</Label>
            <Input id="template-keyword" {...register('primaryKeyword')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-objective">Objetivo del artículo</Label>
            <Textarea id="template-objective" {...register('objective')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-cta">Llamada a la acción (opcional)</Label>
            <Input id="template-cta" {...register('callToAction')} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar plantilla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
