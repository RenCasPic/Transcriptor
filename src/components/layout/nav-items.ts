import { LayoutDashboard, FolderPlus, LayoutTemplate, Settings, User, Building2 } from 'lucide-react';

export const MAIN_NAV_ITEMS = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/projects/new', key: 'newProject', icon: FolderPlus },
  { href: '/templates', key: 'templates', icon: LayoutTemplate },
] as const;

export const SETTINGS_NAV_ITEMS = [
  { href: '/settings/profile', key: 'profile', icon: User },
  { href: '/settings/workspace', key: 'workspace', icon: Building2 },
] as const;

export const SETTINGS_ROOT = { href: '/settings', key: 'settings', icon: Settings } as const;
