'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import { SETTINGS_NAV_ITEMS } from './nav-items';

export function SettingsTabs() {
  const pathname = usePathname();
  const dictionary = useDictionary();

  return (
    <div className="flex gap-1 border-b">
      {SETTINGS_NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <item.icon className="h-4 w-4" />
            {dictionary.nav[item.key]}
          </Link>
        );
      })}
    </div>
  );
}
