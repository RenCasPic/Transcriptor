import Link from 'next/link';
import type { Metadata } from 'next';
import { ForgotPasswordForm } from './forgot-password-form';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getDictionary();
  return { title: dictionary.auth.forgotPassword.title };
}

export default async function ForgotPasswordPage() {
  const { dictionary: t } = await getDictionary();

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t.auth.forgotPassword.title}</h1>
        <p className="text-sm text-muted-foreground">{t.auth.forgotPassword.subtitle}</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t.auth.forgotPassword.backToLogin}
        </Link>
      </p>
    </div>
  );
}
