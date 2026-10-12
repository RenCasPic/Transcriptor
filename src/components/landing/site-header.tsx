import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import { MobileMenu } from '@/components/landing/mobile-menu';
import { getDictionary } from '@/lib/i18n/get-dictionary';

/**
 * Cabecera pública (landing y /precios). Desde md muestra todo en línea; por
 * debajo, solo logo + botón de registro + menú "☰" (Precios, acceso, idioma y tema).
 */
export async function SiteHeader() {
  const { dictionary: t } = await getDictionary();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-2 px-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-[0.95rem] sm:text-base">{t.common.appName}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex lg:gap-2">
          <Button variant="ghost" asChild className="px-2 lg:px-4">
            <Link href="/precios">{t.landing.pricingNav}</Link>
          </Button>
          <Button variant="ghost" asChild className="px-2 lg:px-4">
            <Link href="/login">{t.landing.signIn}</Link>
          </Button>
          <LanguageSwitcher />
          <ThemeSwitcher />
          <Button asChild className="px-3 lg:px-4">
            <Link href="/register">
              <span className="lg:hidden">{t.landing.startFree}</span>
              <span className="hidden lg:inline">{t.landing.createFreeAccount}</span>
              <ArrowRight className="hidden h-4 w-4 lg:block" />
            </Link>
          </Button>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <Button asChild className="h-8 px-2.5 text-xs">
            <Link href="/register">{t.landing.startFree}</Link>
          </Button>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
