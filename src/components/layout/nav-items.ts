import { LayoutDashboard, Settings, User, Building2, Youtube } from 'lucide-react';

export const MAIN_NAV_ITEMS = [{ href: '/dashboard', key: 'dashboard', icon: LayoutDashboard }] as const;

export const SETTINGS_NAV_ITEMS = [
  { href: '/settings/profile', key: 'profile', icon: User },
  { href: '/settings/workspace', key: 'workspace', icon: Building2 },
  { href: '/settings/integrations', key: 'integrations', icon: Youtube },
] as const;

export const SETTINGS_ROOT = { href: '/settings', key: 'settings', icon: Settings } as const;
