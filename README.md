# Transcriptor

Convierte transcripciones de video, audio o texto en artículos de blog editables, verificables y listos para publicar.

Aplicación SaaS construida con **Next.js (App Router) + TypeScript estricto + Supabase (Postgres, Auth, Storage) + TipTap + Tailwind/shadcn-ui**.

> ⚠️ **Nota sobre este entorno**: este proyecto se generó en un entorno sin Node.js/npm instalados, por lo que el código no pudo compilarse, lintearse ni probarse automáticamente durante su creación. Sigue los pasos de este README en tu máquina para instalar dependencias y verificar que todo compile antes de usarlo en producción.

## Índice

- [Requisitos previos](#requisitos-previos)
- [Desarrollo local](#desarrollo-local)
- [Conectar Supabase](#conectar-supabase)
- [Configurar el proveedor de IA](#configurar-el-proveedor-de-ia)
- [Modo demo (sin claves de IA)](#modo-demo-sin-claves-de-ia)
- [Ejecutar pruebas](#ejecutar-pruebas)
- [Desplegar en Vercel](#desplegar-en-vercel)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Documentación adicional](#documentación-adicional)

## Requisitos previos

- Node.js 20+
- npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase` o vía Homebrew/Scoop)
- Docker (lo requiere `supabase start` para levantar Postgres localmente)

## Desarrollo local

```bash
npm install
cp .env.example .env.local
# Completa .env.local (ver siguiente sección)
npm run dev
```

La app queda disponible en `http://localhost:3000`.

## Conectar Supabase

### Opción A — Supabase local (recomendado para desarrollo)

```bash
supabase start
```

Esto levanta Postgres, Auth, Storage y Studio localmente y aplica las migraciones de `supabase/migrations`. Al finalizar, `supabase start` imprime la URL y las claves (`anon key`, `service_role key`) que debes copiar a `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key impresa por supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key impresa por supabase start>
```

Para cargar los datos de demostración (usuario, workspace, proyectos, transcripción y artículo de ejemplo):

```bash
supabase db reset
```

`supabase db reset` vuelve a aplicar todas las migraciones y luego `supabase/seed.sql` automáticamente.

Usuario demo: `demo@transcriptor.app` / `Demo1234!` (si tu versión de GoTrue no acepta la inserción manual en `auth.users`, simplemente regístrate desde `/register`; el resto de la app funciona igual).

### Opción B — Proyecto Supabase remoto

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Copia `Project URL`, `anon public key` y `service_role key` desde Project Settings → API a tu `.env.local`.
3. Aplica las migraciones:

```bash
supabase link --project-ref <tu-project-ref>
supabase db push
```

4. (Opcional) Aplica el seed manualmente desde el SQL Editor del dashboard, pegando el contenido de `supabase/seed.sql`.

### Row Level Security

Todas las tablas privadas tienen RLS habilitado (ver `supabase/migrations/0003_workspaces.sql` en adelante). Ningún usuario puede leer o modificar proyectos de un workspace al que no pertenece; esto se aplica tanto desde el cliente (clave anónima) como desde las Server Actions (que usan la sesión del usuario, nunca la service role key, salvo en tareas administrativas explícitas).

## Configurar el proveedor de IA

La generación de contenido está detrás de la interfaz `ContentGenerationProvider` (`src/lib/ai/provider.ts`). El proveedor activo se elige con variables de entorno, **nunca se llama a un proveedor de IA desde el navegador**.

```env
AI_PROVIDER=mock       # mock | anthropic | openai
AI_API_KEY=            # requerido si AI_PROVIDER no es "mock"
AI_MODEL=              # opcional, cada proveedor tiene un default razonable
```

- **`mock`** (default): genera artículos de forma determinista reorganizando la transcripción real, sin llamar a ningún servicio externo. Ideal para desarrollo, pruebas y demos.
- **`anthropic`**: usa la API de Mensajes de Anthropic (`AI_API_KEY` = API key de Anthropic).
- **`openai`**: usa la API de Chat Completions de OpenAI (`AI_API_KEY` = API key de OpenAI).

Si `AI_PROVIDER` no es `mock` pero falta `AI_API_KEY`, la app recurre automáticamente al proveedor mock para no romper el modo demo.

Para añadir un proveedor nuevo: implementa `ContentGenerationProvider` en `src/lib/ai/providers/`, y regístralo en el switch de `src/lib/ai/providers/generic-provider.ts` (o crea una clase independiente y añade el caso en `src/lib/ai/providers/index.ts`).

## Modo demo (sin claves de IA)

Con `AI_PROVIDER=mock` (el valor por defecto en `.env.example`) puedes recorrer todo el flujo —crear proyecto, cargar transcripción de demo, generar artículo, editar, ver alertas y fuentes, historial de versiones, exportar— sin configurar ninguna clave externa.

## Ejecutar pruebas

```bash
npm run typecheck   # TypeScript en modo estricto
npm run lint        # ESLint
npm test            # Vitest (pruebas unitarias)
npm run test:e2e    # Playwright (requiere Supabase local + npm run dev)
```

Las pruebas end-to-end (`npm run test:e2e`) asumen `AI_PROVIDER=mock` y Supabase local corriendo con las migraciones aplicadas.

## Desplegar en Vercel

1. Crea un proyecto Supabase (ver [Conectar Supabase](#conectar-supabase), Opción B) y aplica las migraciones con `supabase db push`.
2. Importa el repositorio en [Vercel](https://vercel.com/new).
3. Configura las variables de entorno del proyecto en Vercel (Settings → Environment Variables) con los mismos nombres de `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`
   - `APP_URL` (la URL pública de tu deployment, p. ej. `https://tu-app.vercel.app`)
   - `INTEGRATIONS_ENCRYPTION_KEY` (una cadena aleatoria de 32 bytes en base64)
4. En Supabase → Authentication → URL Configuration, añade `https://tu-app.vercel.app/auth/callback` a las Redirect URLs.
5. Despliega. Vercel detecta Next.js automáticamente (`npm run build`).

## Estructura del proyecto

```text
src/
  app/                    # Rutas (App Router)
    (auth)/               # login, register, forgot-password, reset-password
    (app)/                # dashboard, projects, settings (rutas protegidas)
    auth/callback/        # intercambio de código de Supabase Auth
  components/
    ui/                   # primitivas shadcn/ui
    layout/                # sidebar, header, tabs de configuración
    dashboard/, projects/, editor/, shared/
  lib/
    supabase/             # clientes browser/server/admin + middleware
    ai/                   # abstracción de proveedores de generación y transcripción
    prompts/              # prompts versionados, uno por operación
    generation/           # pipeline de negocio de generación (desacoplado del transporte)
    content/              # normalización, métricas, slugs, transform ProseMirror↔HTML/MD
    editor/               # extensión TipTap de blockId, hook de autosave
    validations/          # esquemas Zod
    actions/              # Server Actions
    data/                 # data fetchers de solo lectura (Server Components)
    types/                # tipos de la base de datos y del dominio
supabase/
  migrations/             # una migración por tabla/concepto, con RLS y triggers
  seed.sql                # datos de demostración
tests/unit/               # Vitest
e2e/                      # Playwright
```

## Documentación adicional

- [ARCHITECTURE.md](./ARCHITECTURE.md) — decisiones de arquitectura y por qué se tomaron.
- [FUTURE_FEATURES.md](./FUTURE_FEATURES.md) — funcionalidades futuras y cómo la arquitectura actual las prepara.
