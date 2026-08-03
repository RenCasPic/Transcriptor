'use client';

import Link from 'next/link';
import { Sparkles, LogOut, User, Building2, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOutAction } from '@/lib/actions/auth';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export function Header({ userName }: { userName: string }) {
  const dictionary = useDictionary();
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
      <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        {dictionary.common.appName}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">{initials || 'U'}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">{userName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
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
          <DropdownMenuItem asChild>
            <Link href="/settings/integrations" className="flex items-center gap-2">
              <Youtube className="h-4 w-4" />
              {dictionary.nav.integrations}
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
    </header>
  );
}
