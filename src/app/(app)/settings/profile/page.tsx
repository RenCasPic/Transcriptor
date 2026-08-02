import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUserProfile } from '@/lib/data/workspace';
import { ProfileForm } from './profile-form';
import { UpdatePasswordForm } from './update-password-form';

export const metadata: Metadata = { title: 'Perfil' };

export default async function ProfileSettingsPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect('/login');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
          <CardDescription>Esta información se usa para identificarte dentro de tu espacio de trabajo.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm defaultFullName={profile.full_name ?? ''} email={profile.email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contraseña</CardTitle>
          <CardDescription>Actualiza la contraseña de tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent>
          <UpdatePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
