'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreateProjectSchema,
  CONTENT_TYPES,
  ARTICLE_TONES,
  type CreateProjectInput,
} from '@/lib/validations/project';
import { CONTENT_TYPE_LABELS, ARTICLE_TONE_LABELS } from '@/lib/types/domain';
import { createProjectAction } from '@/lib/actions/projects';

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'pt', label: 'Portugués' },
  { value: 'fr', label: 'Francés' },
];

export function NewProjectForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: { tone: 'professional', contentType: 'guide', language: 'es' },
  });

  async function onSubmit(values: CreateProjectInput) {
    setIsSubmitting(true);
    const result = await createProjectAction(values);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    toast.success('Proyecto creado');
    router.push(`/projects/${result.data.id}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Nombre del proyecto</Label>
          <Input id="name" placeholder="Ej. Episodio 12 — Marketing de contenidos" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="provisionalTitle">Título provisional (opcional)</Label>
          <Input id="provisionalTitle" placeholder="Puedes cambiarlo luego" {...register('provisionalTitle')} />
        </div>

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

        <div className="space-y-1.5">
          <Label>Idioma</Label>
          <Controller
            control={control}
            name="language"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="primaryKeyword">Palabra clave principal (opcional)</Label>
          <Input id="primaryKeyword" placeholder="Ej. marketing de contenidos" {...register('primaryKeyword')} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="audience">Audiencia</Label>
          <Input id="audience" placeholder="Ej. Founders de startups B2B" {...register('audience')} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="objective">Objetivo del artículo</Label>
          <Textarea
            id="objective"
            placeholder="Ej. Explicar cómo estructurar un plan de contenidos trimestral"
            {...register('objective')}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="callToAction">Llamada a la acción (opcional)</Label>
          <Input id="callToAction" placeholder="Ej. Agenda una consultoría gratuita" {...register('callToAction')} />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Crear proyecto
      </Button>
    </form>
  );
}
