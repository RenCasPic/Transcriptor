import { z } from 'zod';

export const SignUpSchema = z.object({
  fullName: z.string().min(2, 'Ingresa tu nombre completo').max(120),
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});
export type SignUpInput = z.infer<typeof SignUpSchema>;

export const SignInSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});
export type SignInInput = z.infer<typeof SignInSchema>;

export const RequestPasswordResetSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
});
export type RequestPasswordResetInput = z.infer<typeof RequestPasswordResetSchema>;

export const UpdatePasswordSchema = z
  .object({
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirma tu nueva contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>;

export const UpdateProfileSchema = z.object({
  fullName: z.string().min(2, 'Ingresa tu nombre completo').max(120),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
