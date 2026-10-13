'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, User, Building2 } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import { signOutAction } from '@/lib/actions/auth';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import { rememberAppPath } from '@/lib/navigation/last-app-path';

export function Header({ userName }: { userName: string }) {
  const dictionary = useDictionary();
  const pathname = usePathname();

  // Para poder volver desde Configuración a la página donde se estaba trabajando.
  useEffect(() => {
    rememberAppPath(pathname);
  }, [pathname]);

  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-3 sm:px-4 lg:px-6">
      <Link href="/" aria-label={dictionary.common.appName} className="flex items-center">
        {/* Crece cuando hay espacio y se encoge en pantallas estrechas (32-44 px). */}
        <Logo sizeClassName="[--logo-size:clamp(32px,calc((100vw_-_320px)_/_3.7),44px)]" />
      </Link>

      <div className="flex items-center gap-1">
        {/* En pantallas estrechas los selectores pasan al menú del avatar. */}
        <div className="hidden items-center gap-1 min-[440px]:flex">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">{initials || 'U'}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">{userName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 min-[440px]:w-48">
            <div className="space-y-2 px-2 py-1.5 min-[440px]:hidden">
              <LanguageSwitcher className="flex w-full [&>button]:flex-1" />
              <ThemeSwitcher className="flex w-full" />
            </div>
            <DropdownMenuSeparator className="min-[440px]:hidden" />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {dictionary.nav.profile}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/workspace" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {dictionary.nav.workspace}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={signOutAction} className="w-full">
                <button type="submit" className="flex w-full items-center gap-2 text-destructive">
                  <LogOut className="h-4 w-4" />
                  {dictionary.header.signOut}
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
