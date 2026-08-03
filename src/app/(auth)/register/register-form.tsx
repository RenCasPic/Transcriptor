'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SignUpSchema, type SignUpInput } from '@/lib/validations/auth';
import { signUpAction } from '@/lib/actions/auth';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export function RegisterForm() {
  const router = useRouter();
  const t = useDictionary();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({ resolver: zodResolver(SignUpSchema) });

  async function onSubmit(values: SignUpInput) {
    setIsSubmitting(true);
    const result = await signUpAction(values);
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    if (result.data.needsEmailConfirmation) {
      setConfirmationSent(true);
      return;
    }

    toast.success(t.auth.register.accountCreated);
    router.push('/dashboard');
    router.refresh();
  }

  if (confirmationSent) {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        {t.auth.register.confirmationSent}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="fullName">{t.auth.register.fullName}</Label>
        <Input id="fullName" autoComplete="name" placeholder="Ana Gómez" {...register('fullName')} />
        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t.auth.register.email}</Label>
        <Input id="email" type="email" autoComplete="email" placeholder={t.common.emailPlaceholder} {...register('email')} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t.auth.register.password}</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {t.auth.register.submit}
      </Button>
    </form>
  );
}
