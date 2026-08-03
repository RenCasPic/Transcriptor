'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, LogOut, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarNav } from './sidebar-nav';
import { signOutAction } from '@/lib/actions/auth';

interface HeaderProps {
  workspaceName: string;
  userName: string;
}

export function Header({ workspaceName, userName }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menú</span>
          </Button>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
            <SidebarNav workspaceName={workspaceName} inSheet />
          </SheetContent>
        </Sheet>
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
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href="/settings/profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/workspace" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Espacio de trabajo
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <form action={signOutAction} className="w-full">
              <button type="submit" className="flex w-full items-center gap-2 text-destructive">
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
