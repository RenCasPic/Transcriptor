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
import { createTemplateAction } from '@/lib/actions/templates';
import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';
import { getDomainLabels } from '@/lib/i18n/domain-labels';

export function CreateTemplateDialog() {
  const router = useRouter();
  const t = useDictionary();
  const locale = useLocale();
  const domainLabels = getDomainLabels(locale);
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

    toast.success(t.templates.dialog.success);
    reset({ tone: 'professional', contentType: 'guide', language: 'es' });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          {t.templates.newTemplate}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.templates.dialog.title}</DialogTitle>
          <DialogDescription>{t.templates.dialog.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="template-name">{t.templates.dialog.nameLabel}</Label>
            <Input id="template-name" placeholder={t.templates.dialog.namePlaceholder} {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t.templates.dialog.contentTypeLabel}</Label>
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
                          {domainLabels.contentType[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.templates.dialog.toneLabel}</Label>
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
                          {domainLabels.articleTone[tone]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-audience">{t.templates.dialog.audienceLabel}</Label>
            <Input id="template-audience" placeholder={t.templates.dialog.audiencePlaceholder} {...register('audience')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-keyword">{t.templates.dialog.keywordLabel}</Label>
            <Input id="template-keyword" {...register('primaryKeyword')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-objective">{t.templates.dialog.objectiveLabel}</Label>
            <Textarea id="template-objective" {...register('objective')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-cta">{t.templates.dialog.ctaLabel}</Label>
            <Input id="template-cta" {...register('callToAction')} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.templates.dialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
