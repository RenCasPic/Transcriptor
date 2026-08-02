'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAIN_NAV_ITEMS, SETTINGS_ROOT } from './nav-items';

export function SidebarNav({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/dashboard" className="flex items-center gap-2 px-2 font-semibold">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        TalkToPost
      </Link>

      <div className="rounded-lg bg-muted/60 px-3 py-2">
        <p className="truncate text-xs font-medium text-muted-foreground">Espacio de trabajo</p>
        <p className="truncate text-sm font-semibold">{workspaceName}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {MAIN_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href={SETTINGS_ROOT.href}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          pathname.startsWith('/settings')
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <SETTINGS_ROOT.icon className="h-4 w-4" />
        {SETTINGS_ROOT.label}
      </Link>
    </div>
  );
}
