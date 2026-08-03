import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUserProfile } from '@/lib/data/workspace';
import { ProfileForm } from './profile-form';
import { UpdatePasswordForm } from './update-password-form';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getDictionary();
  return { title: dictionary.nav.profile };
}

export default async function ProfileSettingsPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect('/login');
  const { dictionary: t } = await getDictionary();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.profile.dataTitle}</CardTitle>
          <CardDescription>{t.settings.profile.dataDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm defaultFullName={profile.full_name ?? ''} email={profile.email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.profile.passwordTitle}</CardTitle>
          <CardDescription>{t.settings.profile.passwordDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <UpdatePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
