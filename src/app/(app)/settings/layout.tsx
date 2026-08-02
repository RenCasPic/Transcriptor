import { SettingsTabs } from '@/components/layout/settings-tabs';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">Gestiona tu cuenta y tu espacio de trabajo</p>
      </div>
      <SettingsTabs />
      {children}
    </div>
  );
}
