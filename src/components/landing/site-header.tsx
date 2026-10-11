import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import { getDictionary } from '@/lib/i18n/get-dictionary';

/** Cabecera pública (landing y /precios): logo, Precios, idioma, tema y acceso. */
export async function SiteHeader() {
  const { dictionary: t } = await getDictionary();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-2 px-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold max-[349px]:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="hidden min-[520px]:inline">{t.common.appName}</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" asChild className="h-8 px-1 text-xs max-[419px]:hidden sm:h-9 sm:px-4 sm:text-sm">
            <Link href="/precios">{t.landing.pricingNav}</Link>
          </Button>
          <LanguageSwitcher />
          <ThemeSwitcher />
          <Button variant="ghost" asChild className="hidden lg:inline-flex">
            <Link href="/login">{t.landing.signIn}</Link>
          </Button>
          <Button asChild className="ml-0.5 h-8 px-2 text-xs sm:ml-0 sm:h-9 sm:px-4 sm:text-sm">
            <Link href="/register">
              <span className="lg:hidden">{t.landing.startFree}</span>
              <span className="hidden lg:inline">{t.landing.createFreeAccount}</span>
              <ArrowRight className="hidden h-4 w-4 lg:block" />
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
