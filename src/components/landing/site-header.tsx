import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
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
        <Link href="/" aria-label={t.common.appName} className="flex shrink-0 items-center">
          {/* Crece cuando hay espacio y se encoge en pantallas estrechas (32-44 px). */}
          <Logo sizeClassName="[--logo-size:clamp(32px,calc((100vw_-_200px)_/_3.7),44px)] md:[--logo-size:38px] lg:[--logo-size:clamp(34px,calc(34px_+_(100vw_-_1024px)_*_0.07),44px)]" />
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
