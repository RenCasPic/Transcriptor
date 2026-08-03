'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UpdateProfileSchema, type UpdateProfileInput } from '@/lib/validations/auth';
import { updateProfileAction } from '@/lib/actions/auth';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export function ProfileForm({ defaultFullName, email }: { defaultFullName: string; email: string }) {
  const t = useDictionary();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: { fullName: defaultFullName },
  });

  async function onSubmit(values: UpdateProfileInput) {
    setIsSubmitting(true);
    const result = await updateProfileAction(values);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success(t.settings.profile.saveSuccess);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t.settings.profile.email}</Label>
        <Input id="email" value={email} disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fullName">{t.settings.profile.fullName}</Label>
        <Input id="fullName" {...register('fullName')} />
        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {t.settings.profile.save}
      </Button>
    </form>
  );
}
