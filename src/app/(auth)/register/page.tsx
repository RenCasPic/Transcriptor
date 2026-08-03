import Link from 'next/link';
import type { Metadata } from 'next';
import { RegisterForm } from './register-form';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getDictionary();
  return { title: dictionary.auth.register.title };
}

export default async function RegisterPage() {
  const { dictionary: t } = await getDictionary();

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t.auth.register.title}</h1>
        <p className="text-sm text-muted-foreground">{t.auth.register.subtitle}</p>
      </div>
      <RegisterForm />
      <p className="text-center text-sm text-muted-foreground">
        {t.auth.register.hasAccount}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t.auth.register.loginLink}
        </Link>
      </p>
    </div>
  );
}
