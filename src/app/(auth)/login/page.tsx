import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from './login-form';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getDictionary();
  return { title: dictionary.auth.login.title };
}

export default async function LoginPage() {
  const { dictionary: t } = await getDictionary();

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t.auth.login.title}</h1>
        <p className="text-sm text-muted-foreground">{t.auth.login.subtitle}</p>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <div className="space-y-2 text-center text-sm">
        <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground hover:underline">
          {t.auth.login.forgotPassword}
        </Link>
        <p className="text-muted-foreground">
          {t.auth.login.noAccount}{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t.auth.login.registerLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
