import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Iniciar sesión' };

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
        <p className="text-sm text-muted-foreground">Accede a tus proyectos y artículos</p>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <div className="space-y-2 text-center text-sm">
        <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
        <p className="text-muted-foreground">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
