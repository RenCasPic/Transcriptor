import { test, expect } from '@playwright/test';

/**
 * Flujo completo del MVP (sección 13 del brief): registro, creación de
 * proyecto, importación de transcripción, generación en modo demo, edición,
 * guardado y exportación.
 *
 * Requiere:
 *   - Supabase local corriendo (`supabase start`) con las migraciones aplicadas.
 *   - AI_PROVIDER=mock (o sin AI_API_KEY) para que la generación no dependa de
 *     una API externa real.
 *   - El servidor de desarrollo accesible en APP_URL (por defecto lo levanta
 *     `playwright.config.ts` con `npm run dev`).
 */

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`;
}

test.describe.serial('flujo completo: de registro a artículo exportado', () => {
  const email = uniqueEmail();
  const password = 'Contraseña123!';

  test('1. Registro de usuario', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Nombre completo').fill('Usuario de Prueba');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page).toHaveURL(/\/dashboard|\/register/, { timeout: 15_000 });
  });

  test('2. Inicio de sesión', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test('3-4. Creación de proyecto e importación de transcripción demo', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await page.getByRole('link', { name: 'Nuevo proyecto' }).first().click();
    await expect(page).toHaveURL(/\/projects\/new/);

    await page.getByLabel('Nombre del proyecto').fill('Proyecto E2E de prueba');
    await page.getByRole('button', { name: 'Crear proyecto' }).click();

    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/, { timeout: 15_000 });

    await page.getByRole('tab', { name: 'Usar demo' }).click();
    await page.getByRole('button', { name: 'Usar transcripción de demostración' }).click();
    await expect(page.getByText('Transcripción cargada')).toBeVisible({ timeout: 10_000 });
  });

  test('5. Generación de artículo en modo demo/mock', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await page.getByText('Proyecto E2E de prueba').first().click();
    await page.getByRole('button', { name: 'Generar artículo' }).click();

    await expect(page).toHaveURL(/\/editor$/, { timeout: 30_000 });
  });

  test('6-7. Edición, guardado automático y exportación', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await page.getByText('Proyecto E2E de prueba').first().click();
    await page.getByRole('link', { name: 'Abrir editor' }).click();
    await expect(page).toHaveURL(/\/editor$/);

    const titleInput = page.getByPlaceholder('Título del artículo');
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    await titleInput.click();
    await titleInput.press('End');
    await page.keyboard.type(' (editado)');

    await expect(page.getByText('Guardando...')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Guardado')).toBeVisible({ timeout: 10_000 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await page.getByRole('button', { name: 'Exportar' }).click();
        await page.getByText('Markdown (.md)').click();
      })(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.md$/);
  });
});
