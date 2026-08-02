import { LayoutDashboard, FolderPlus, Settings, User, Building2 } from 'lucide-react';

export const MAIN_NAV_ITEMS = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/projects/new', label: 'Nuevo proyecto', icon: FolderPlus },
];

export const SETTINGS_NAV_ITEMS = [
  { href: '/settings/profile', label: 'Perfil', icon: User },
  { href: '/settings/workspace', label: 'Espacio de trabajo', icon: Building2 },
];

export const SETTINGS_ROOT = { href: '/settings', label: 'Configuración', icon: Settings };
