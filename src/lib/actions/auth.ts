'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  SignUpSchema,
  SignInSchema,
  RequestPasswordResetSchema,
  UpdatePasswordSchema,
  UpdateProfileSchema,
  type SignUpInput,
  type SignInInput,
  type RequestPasswordResetInput,
  type UpdatePasswordInput,
  type UpdateProfileInput,
} from '@/lib/validations/auth';
import { ok, err, type ActionResult } from '@/lib/types/domain';

function appUrl() {
  return process.env.APP_URL ?? 'http://localhost:3000';
}

export async function signUpAction(input: SignUpInput): Promise<ActionResult<{ needsEmailConfirmation: boolean }>> {
  const parsed = SignUpSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${appUrl()}/auth/callback`,
    },
  });

  if (error) {
    return err('SIGN_UP_ERROR', translateAuthError(error.message));
  }

  return ok({ needsEmailConfirmation: !data.session });
}

export async function signInAction(input: SignInInput): Promise<ActionResult<null>> {
  const parsed = SignInSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return err('SIGN_IN_ERROR', translateAuthError(error.message));
  }

  return ok(null);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function requestPasswordResetAction(
  input: RequestPasswordResetInput,
): Promise<ActionResult<null>> {
  const parsed = RequestPasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl()}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return err('RESET_PASSWORD_ERROR', translateAuthError(error.message));
  }

  return ok(null);
}

export async function updatePasswordAction(input: UpdatePasswordInput): Promise<ActionResult<null>> {
  const parsed = UpdatePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return err('UPDATE_PASSWORD_ERROR', translateAuthError(error.message));
  }

  return ok(null);
}

export async function updateProfileAction(input: UpdateProfileInput): Promise<ActionResult<null>> {
  const parsed = UpdateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err('UNAUTHENTICATED', 'Debes iniciar sesión.');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName })
    .eq('id', user.id);

  if (error) {
    return err('UPDATE_PROFILE_ERROR', 'No se pudo actualizar el perfil.');
  }

  revalidatePath('/settings/profile');
  return ok(null);
}

/** Traduce los mensajes de error más comunes de Supabase Auth al español. */
function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) {
    return 'Correo electrónico o contraseña incorrectos.';
  }
  if (normalized.includes('user already registered')) {
    return 'Ya existe una cuenta con este correo electrónico.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Debes confirmar tu correo electrónico antes de iniciar sesión.';
  }
  if (normalized.includes('password should be at least')) {
    return 'La contraseña es demasiado corta.';
  }
  return 'Ocurrió un error. Inténtalo de nuevo.';
}
