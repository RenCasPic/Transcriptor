'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MAIN_NAV_ITEMS, SETTINGS_ROOT } from './nav-items';

const STORAGE_KEY = 'sidebar-collapsed';

export function SidebarNav({
  workspaceName,
  inSheet = false,
}: {
  workspaceName: string;
  /** Cuando se renderiza dentro del Sheet móvil: siempre expandido, sin botón de colapsar. */
  inSheet?: boolean;
}) {
  const pathname = usePathname();
  const [collapsedState, setCollapsedState] = useState(false);
  const collapsed = inSheet ? false : collapsedState;

  useEffect(() => {
    if (inSheet) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === '1') setCollapsedState(true);
  }, [inSheet]);

  function toggleCollapsed() {
    setCollapsedState((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'shrink-0 border-r transition-[width] duration-200',
          inSheet ? 'block w-full border-none' : 'hidden lg:block',
          !inSheet && (collapsed ? 'w-16' : 'w-64'),
        )}
      >
        <div className="flex h-full flex-col gap-6 p-4">
          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between')}>
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </div>
              {!collapsed && 'TalkToPost'}
            </Link>
            {!collapsed && !inSheet && (
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={toggleCollapsed}>
                <ChevronsLeft className="h-4 w-4" />
                <span className="sr-only">Colapsar menú</span>
              </Button>
            )}
          </div>

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 self-center" onClick={toggleCollapsed}>
                  <ChevronsRight className="h-4 w-4" />
                  <span className="sr-only">Expandir menú</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir menú</TooltipContent>
            </Tooltip>
          ) : (
            <div className="rounded-lg border-l-2 border-primary bg-gradient-to-br from-indigo-500/10 to-violet-500/10 px-3 py-2">
              <p className="truncate text-xs font-medium text-muted-foreground">Espacio de trabajo</p>
              <p className="truncate text-sm font-semibold">{workspaceName}</p>
            </div>
          )}

          <nav className="flex flex-1 flex-col gap-1">
            {MAIN_NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && item.label}
                </Link>
              );

              if (!collapsed) return link;

              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {(() => {
            const isSettingsActive = pathname.startsWith('/settings');
            const settingsLink = (
              <Link
                href={SETTINGS_ROOT.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-0',
                  isSettingsActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <SETTINGS_ROOT.icon className="h-4 w-4 shrink-0" />
                {!collapsed && SETTINGS_ROOT.label}
              </Link>
            );

            if (!collapsed) return settingsLink;

            return (
              <Tooltip>
                <TooltipTrigger asChild>{settingsLink}</TooltipTrigger>
                <TooltipContent side="right">{SETTINGS_ROOT.label}</TooltipContent>
              </Tooltip>
            );
          })()}
        </div>
      </aside>
    </TooltipProvider>
  );
}
