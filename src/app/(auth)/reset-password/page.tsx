import type { Metadata } from 'next';
import { ResetPasswordForm } from './reset-password-form';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getDictionary();
  return { title: dictionary.auth.resetPassword.title };
}

export default async function ResetPasswordPage() {
  const { dictionary: t } = await getDictionary();

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t.auth.resetPassword.title}</h1>
        <p className="text-sm text-muted-foreground">{t.auth.resetPassword.subtitle}</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
