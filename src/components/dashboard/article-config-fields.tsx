import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CONTENT_TYPES, ARTICLE_TONES, type ArticleConfigInput } from '@/lib/validations/project';
import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';
import { getDomainLabels } from '@/lib/i18n/domain-labels';

/**
 * Campos de "configuración del artículo" (tipo de contenido, tono, audiencia,
 * palabra clave, objetivo, CTA) compartidos por las tarjetas "Subir video" y
 * "Conectar YouTube" del Dashboard, para no duplicar el mismo formulario dos
 * veces.
 */
export function ArticleConfigFields({
  idPrefix,
  register,
  control,
  errors,
}: {
  idPrefix: string;
  register: UseFormRegister<ArticleConfigInput>;
  control: Control<ArticleConfigInput>;
  errors: FieldErrors<ArticleConfigInput>;
}) {
  const t = useDictionary();
  const locale = useLocale();
  const domainLabels = getDomainLabels(locale);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-contentType`}>{t.projects.new.contentTypeLabel}</Label>
        <Controller
          control={control}
          name="contentType"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={`${idPrefix}-contentType`}>
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
        <Label htmlFor={`${idPrefix}-tone`}>{t.projects.new.toneLabel}</Label>
        <Controller
          control={control}
          name="tone"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={`${idPrefix}-tone`}>
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

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-audience`}>{t.projects.new.audienceLabel}</Label>
        <Input
          id={`${idPrefix}-audience`}
          placeholder={t.projects.new.audiencePlaceholder}
          {...register('audience')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-primaryKeyword`}>{t.projects.new.keywordLabel}</Label>
        <Input
          id={`${idPrefix}-primaryKeyword`}
          placeholder={t.projects.new.keywordPlaceholder}
          {...register('primaryKeyword')}
        />
        {errors.primaryKeyword && <p className="text-xs text-destructive">{errors.primaryKeyword.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-callToAction`}>{t.projects.new.ctaLabel}</Label>
        <Input
          id={`${idPrefix}-callToAction`}
          placeholder={t.projects.new.ctaPlaceholder}
          {...register('callToAction')}
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-objective`}>{t.projects.new.objectiveLabel}</Label>
        <Textarea
          id={`${idPrefix}-objective`}
          placeholder={t.projects.new.objectivePlaceholder}
          {...register('objective')}
        />
      </div>
    </div>
  );
}
