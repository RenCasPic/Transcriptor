import { SettingsTabs } from '@/components/layout/settings-tabs';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { dictionary: t } = await getDictionary();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.settings.title}</h1>
        <p className="text-sm text-muted-foreground">{t.settings.subtitle}</p>
      </div>
      <SettingsTabs />
      {children}
    </div>
  );
}
