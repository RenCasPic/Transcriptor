'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

/**
 * Menú "☰" de la cabecera pública en pantallas menores a md: enlaces (Precios,
 * Iniciar sesión) y los selectores de idioma y tema, con sus nombres.
 */
export function MobileMenu() {
  const t = useDictionary();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 border-primary/30" aria-label={t.landing.menu}>
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-[88%] max-w-xs flex-col gap-6 p-4" aria-describedby={undefined}>
        <SheetTitle>{t.common.appName}</SheetTitle>

        <nav className="flex flex-col gap-1">
          <SheetClose asChild>
            <Button variant="ghost" asChild className="-mx-2 justify-start px-2">
              <Link href="/precios">{t.landing.pricingNav}</Link>
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button variant="ghost" asChild className="-mx-2 justify-start px-2">
              <Link href="/login">{t.landing.signIn}</Link>
            </Button>
          </SheetClose>
        </nav>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{t.language.label}</p>
          <LanguageSwitcher />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{t.theme.label}</p>
          <ThemeSwitcher showLabels className="flex w-full" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
