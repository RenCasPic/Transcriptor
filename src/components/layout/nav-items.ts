import { User, Building2 } from 'lucide-react';

export const SETTINGS_NAV_ITEMS = [
  { href: '/settings/profile', key: 'profile', icon: User },
  { href: '/settings/workspace', key: 'workspace', icon: Building2 },
] as const;
