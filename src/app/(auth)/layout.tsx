import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/30 px-4 pb-12 pt-20 sm:py-12">
      <div className="absolute right-3 top-3 flex items-center gap-1 sm:right-5 sm:top-5">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
      <Link href="/" aria-label="TalkToPost" className="flex items-center">
        <Logo size={56} />
      </Link>
      <div className="w-full max-w-md rounded-xl border border-primary bg-background p-8 shadow-sm">{children}</div>
    </div>
  );
}
