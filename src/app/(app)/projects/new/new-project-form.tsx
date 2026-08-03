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
import { createProjectAction } from '@/lib/actions/projects';
import { createTemplateAction } from '@/lib/actions/templates';
import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';
import { getDomainLabels } from '@/lib/i18n/domain-labels';
import type { ProjectTemplateItem } from '@/lib/data/templates';

export function NewProjectForm({ template }: { template?: ProjectTemplateItem | null }) {
  const router = useRouter();
  const t = useDictionary();
  const locale = useLocale();
  const domainLabels = getDomainLabels(locale);
  const LANGUAGES = [
    { value: 'es', label: t.projects.new.languageOptions.es },
    { value: 'en', label: t.projects.new.languageOptions.en },
    { value: 'pt', label: t.projects.new.languageOptions.pt },
    { value: 'fr', label: t.projects.new.languageOptions.fr },
  ];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: template
      ? {
          contentType: template.contentType,
          tone: template.tone,
          language: template.language,
          audience: template.audience ?? '',
          primaryKeyword: template.primaryKeyword ?? '',
          objective: template.objective ?? '',
          callToAction: template.callToAction ?? '',
        }
      : { tone: 'professional', contentType: 'guide', language: 'es' },
  });

  async function onSubmit(values: CreateProjectInput) {
    setIsSubmitting(true);
    const result = await createProjectAction(values);

    if (!result.success) {
      setIsSubmitting(false);
      toast.error(result.error.message);
      return;
    }

    if (saveAsTemplate && templateName.trim()) {
      const templateResult = await createTemplateAction({
        name: templateName.trim(),
        contentType: values.contentType,
        tone: values.tone,
        language: values.language,
        audience: values.audience,
        primaryKeyword: values.primaryKeyword,
        objective: values.objective,
        callToAction: values.callToAction,
      });
      if (!templateResult.success) {
        toast.error(`${t.projects.new.createdButTemplateFailed} ${templateResult.error.message}`);
      } else {
        toast.success(t.projects.new.successWithTemplate);
      }
    } else {
      toast.success(t.projects.new.success);
    }

    setIsSubmitting(false);
    router.push(`/projects/${result.data.id}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">{t.projects.new.nameLabel}</Label>
          <Input id="name" placeholder={t.projects.new.namePlaceholder} {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="provisionalTitle">{t.projects.new.provisionalTitleLabel}</Label>
          <Input id="provisionalTitle" placeholder={t.projects.new.provisionalTitlePlaceholder} {...register('provisionalTitle')} />
        </div>

        <div className="space-y-1.5">
          <Label>{t.projects.new.contentTypeLabel}</Label>
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
          <Label>{t.projects.new.toneLabel}</Label>
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

        <div className="space-y-1.5">
          <Label>{t.projects.new.languageLabel}</Label>
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
          <Label htmlFor="primaryKeyword">{t.projects.new.keywordLabel}</Label>
          <Input id="primaryKeyword" placeholder={t.projects.new.keywordPlaceholder} {...register('primaryKeyword')} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="audience">{t.projects.new.audienceLabel}</Label>
          <Input id="audience" placeholder={t.projects.new.audiencePlaceholder} {...register('audience')} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="objective">{t.projects.new.objectiveLabel}</Label>
          <Textarea
            id="objective"
            placeholder={t.projects.new.objectivePlaceholder}
            {...register('objective')}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="callToAction">{t.projects.new.ctaLabel}</Label>
          <Input id="callToAction" placeholder={t.projects.new.ctaPlaceholder} {...register('callToAction')} />
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-dashed p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-primary"
            checked={saveAsTemplate}
            onChange={(e) => setSaveAsTemplate(e.target.checked)}
          />
          {t.projects.new.saveAsTemplate}
        </label>
        {saveAsTemplate && (
          <Input
            placeholder={t.projects.new.templateNamePlaceholder}
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {t.projects.new.submit}
      </Button>
    </form>
  );
}
