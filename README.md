# Transcriptor

Convierte transcripciones de video, audio o texto en artículos de blog editables, verificables y listos para publicar.

Aplicación SaaS construida con **Next.js (App Router) + TypeScript estricto + Supabase (Postgres, Auth, Storage) + TipTap + Tailwind/shadcn-ui**.

> ⚠️ **Nota sobre este entorno**: este proyecto se generó en un entorno sin Node.js/npm instalados, por lo que el código no pudo compilarse, lintearse ni probarse automáticamente durante su creación. Sigue los pasos de este README en tu máquina para instalar dependencias y verificar que todo compile antes de usarlo en producción.

## Índice

- [Requisitos previos](#requisitos-previos)
- [Desarrollo local](#desarrollo-local)
- [Conectar Supabase](#conectar-supabase)
- [Configurar el proveedor de IA](#configurar-el-proveedor-de-ia)
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
AI_PROVIDER=openai     # openai (default) | anthropic | groq
AI_API_KEY=            # key del proveedor de IA (para OpenAI empieza por "sk-")
AI_MODEL=              # opcional; default: openai -> gpt-4o-mini
AI_MAX_PROMPT_TOKENS=  # opcional; tope de tokens de entrada (default 110000)
```

- **`openai`** (default, modelo `gpt-4o-mini`): barato (fracciones de céntimo por artículo) y con 128k de contexto — **cabe cualquier transcripción realista de una sola pasada** (hasta varias horas). Necesitas una cuenta con saldo.
- **`anthropic`**: API de Mensajes de Anthropic (`AI_API_KEY` = key de Anthropic; modelo por defecto `claude-sonnet-5`).
- **`groq`**: `AI_API_KEY` (o `GROQ_API_KEY`). ⚠️ El plan **gratuito** de Groq limita a ~8000 tokens/min por modelo: sirve para transcripción pero **no** para generar artículos de contenido real (`413`). Solo úsalo para generación con el **Dev Tier** de Groq.

**La generación de artículos requiere una API key.** Sin `AI_API_KEY` (ni `GROQ_API_KEY` cuando `AI_PROVIDER=groq`), `generateArticleAction` devuelve un `ActionResult` de error explícito (`AI_NOT_CONFIGURED`) — no hay proveedor "mock" ni contenido de ejemplo.

**Longitud del artículo (transcripciones largas).** gpt-4o-mini no desarrolla bien una transcripción larga en una sola llamada: la comprime en un resumen corto aunque le quepa en contexto. Para transcripciones de más de `AI_SINGLE_PASS_MAX_SEGMENTS` segmentos (~70, ≈ 8 min) la generación pasa a **varias etapas**:

1. **Extracción** — la transcripción se parte en bloques de ~45 segmentos y de cada uno se extraen notas estructuradas (ideas, argumentos, ejemplos, cifras, nombres, citas) sin resumir, en paralelo.
2. **Esqueleto** — una llamada agrupa todas las notas en 6-16 secciones temáticas ordenadas.
3. **Redacción por secciones** — cada sección se redacta en su propia llamada (tarea acotada → el modelo la desarrolla a fondo), en paralelo.
4. **Metadatos** — excerpt, FAQ, SEO y alertas.
5. **Ensamblado** — se unen las secciones; los `sourceSegmentIds` de cada bloque se calculan de las notas que desarrolla (traza `s0`,`s1`… → UUID real).

Resultado típico: un audio de 26 min pasa de ~550 palabras a ~4.500-6.000 (proporcional al contenido, no a un ratio fijo). Coste con gpt-4o-mini: ~$0,02 por artículo. Ajustable con `AI_EXTRACT_BLOCK_SEGMENTS`, `AI_EXTRACT_CONCURRENCY`, `AI_SECTION_CONCURRENCY`. Transcripciones cortas siguen el camino de una sola llamada.

**Robustez y coste:**
- El prompt usa etiquetas de segmento cortas (`s0`, `s1`…) en vez de UUIDs; el proveedor las traduce de vuelta al persistir, la trazabilidad no cambia.
- Reintento automático ante `429` (rate limit) y `5xx`, respetando `retry-after`. No reintenta `401`/`413`/cuota agotada. Cada etapa reintenta y tiene un fallback para no perder contenido si una llamada falla.
- Guarda de tamaño: si el prompt supera `AI_MAX_PROMPT_TOKENS`, falla antes de llamar con `AI_TRANSCRIPT_TOO_LONG`.
- Errores diferenciados y accionables: API key inválida, sin créditos, rate limit, petición demasiado grande, error temporal del proveedor, respuesta con formato inesperado. La transcripción **siempre se conserva**: el mensaje indica reintentar "Generar artículo" desde el proyecto.
- Las páginas que disparan la generación declaran `maxDuration = 300` (la variante en varias etapas para un audio largo tarda ~1-2 min).

Para añadir un proveedor nuevo: implementa `ContentGenerationProvider` en `src/lib/ai/providers/`, y regístralo en el switch de `src/lib/ai/providers/generic-provider.ts` (o crea una clase independiente y añade el caso en `src/lib/ai/providers/index.ts`).

### Transcripción de video/audio (Whisper / Groq)

Además de pegar texto o subir TXT/SRT/VTT, se puede subir un archivo de video o audio (mp4, mov, webm, mkv, mp3, wav, m4a, aac, ogg, flac) para transcribirlo automáticamente:

```env
TRANSCRIPTION_PROVIDER=groq      # groq | whisper
TRANSCRIPTION_API_KEY=           # opcional si usas Groq (basta GROQ_API_KEY)
```

`groq` es gratis dentro de un límite de uso razonable; `whisper` usa la API de Whisper de OpenAI (`whisper-1`), que **tiene costo por minuto transcrito**. **La transcripción requiere una API key** (`TRANSCRIPTION_API_KEY` o `GROQ_API_KEY`): sin ella, subir audio/video o el fallback de audio de YouTube devuelven un error explícito (`TRANSCRIPTION_NOT_CONFIGURED`).

#### Archivos grandes (podcasts / videos de 40-50 min)

> Requiere la migración `0020` aplicada (`supabase db push`, o pega
> `supabase/migrations/0020_large_media_uploads.sql` en el SQL Editor).

**1. Extracción de audio en el navegador (antes de subir).** Si eliges un video, o un audio grande, el navegador extrae y comprime el audio a un MP3 mono de 16 kHz / 32 kbps con **ffmpeg.wasm** — un podcast de 50 min queda en ~12 MB. El video original nunca se sube. Los audios pequeños (< `MEDIA_CLIENT_EXTRACT_THRESHOLD_MB`, 15 por defecto) se suben tal cual sin pasar por el conversor. El core de ffmpeg.wasm (~32 MB) se sirve desde `/public/ffmpeg/` (lo copia `scripts/setup-ffmpeg-assets.mjs` en `postinstall` / `prebuild`; no se versiona) y se descarga una sola vez por navegador.

**2. Subida directa a Storage.** Ese audio se sube **directamente del navegador a Supabase Storage** con una _signed upload URL_ — los bytes nunca pasan por una Server Action ni por el límite de payload de Next.js.

**3. Transcripción en segundo plano** (`generation_jobs`): la UI muestra el progreso (cargando conversor → extrayendo audio → subiendo → transcribiendo → generando) y puedes cerrar la página y volver. Si el audio subido aún supera el límite por petición del proveedor (25 MB en Whisper/Groq), el servidor lo **trocea** con ffmpeg y recompone una transcripción única con timestamps corregidos (la trazabilidad bloque→segmento se mantiene).

Límites configurables (ver `.env.example`): `MEDIA_MAX_SOURCE_MB` (2000, lo que el usuario puede elegir), `MEDIA_MAX_UPLOAD_MB` (lo que se sube tras extraer), `MEDIA_CLIENT_EXTRACT_THRESHOLD_MB`, `MEDIA_MAX_DURATION_SECONDS`, `MEDIA_CHUNK_*`.

> **Límite de subida a Storage = min(`MEDIA_MAX_UPLOAD_MB`, límite global de Storage del proyecto Supabase).**
> El plan **gratuito** de Supabase topa en **50 MB por archivo**; los planes de pago llegan a 50 GB (Dashboard → Storage → Settings → *Upload file size limit*). Gracias a la extracción de audio en el navegador, 50 MB de audio comprimido alcanzan para varias horas de contenido. La migración `0020` deja el `file_size_limit` del bucket en `NULL` para heredar el límite global.

#### Worker / cron (opcional)

Por defecto, el job se procesa vía `after()` dentro de la misma invocación serverless que lo encola. Para archivos muy largos o para mayor robustez, configura `JOBS_WORKER_SECRET` y llama periódicamente a `POST /api/jobs/transcription` (cabecera `x-jobs-secret`) desde un cron (Vercel Cron, GitHub Actions, etc.): drena los jobs `queued` y retoma los `processing` colgados. Mover el procesamiento a un worker dedicado es cambiar quién llama a ese endpoint, no cómo funciona el pipeline.

### Importar desde YouTube

Se puede pegar el enlace de cualquier video público de YouTube (propio o ajeno) y la app importa sus subtítulos ya existentes como transcripción — no hace falta conectar ninguna cuenta ni configurar credenciales. Ver `src/lib/integrations/youtube-transcript.ts` para el detalle: no usa la Data API oficial de YouTube (que no permite descargar video/audio ni siquiera para el canal propio), sino que lee la página pública del video igual que hace el reproductor web, así que depende de un endpoint no documentado que YouTube podría cambiar sin aviso. Si el video no tiene subtítulos, hay que subirlo manualmente (pestaña "Video o audio").

## Ejecutar pruebas

```bash
npm run typecheck   # TypeScript en modo estricto
npm run lint        # ESLint
npm test            # Vitest (pruebas unitarias)
npm run test:e2e    # Playwright (requiere Supabase local + npm run dev)
```

Las pruebas end-to-end (`npm run test:e2e`) necesitan Supabase local corriendo con las migraciones aplicadas. El paso de generación de artículo se omite automáticamente si no hay `GROQ_API_KEY` / `AI_API_KEY`.

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
    api/jobs/transcription/ # Route Handler para el worker/cron de transcripción
  components/
    ui/                   # primitivas shadcn/ui
    layout/                # sidebar, header, tabs de configuración
    dashboard/, projects/, editor/, shared/
  lib/
    supabase/             # clientes browser/server/admin + middleware
    ai/                   # abstracción de proveedores de generación y transcripción
    media/                # límites configurables, formatos, troceado de audio (ffmpeg), merge de chunks
    prompts/              # prompts versionados, uno por operación
    generation/           # pipelines de negocio (generación de artículo + transcripción), desacoplados del transporte
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
