# Funciones futuras

Marcadas como "Próximamente" en la interfaz actual. La arquitectura ya las contempla en el modelo de datos y en las abstracciones; esto describe qué falta para activarlas.

## Subida de audio/video

- **Modelo de datos**: `media_sources.source_type` ya acepta `'audio'` y `'video'`; el bucket `project-sources` en Storage ya permite los MIME types correspondientes (`supabase/migrations/0015_storage.sql`).
- **Falta**: UI de subida con progreso, un `TranscriptionProvider` real (ver siguiente punto) y un `generation_jobs.job_type = 'transcribe'` que procese el archivo en segundo plano.

## Proveedor de transcripción real (Whisper u otro)

- **Ya existe**: la interfaz `TranscriptionProvider` (`src/lib/ai/provider.ts`) y la fábrica `getTranscriptionProvider()` (`src/lib/ai/transcription/index.ts`), hoy solo con `DemoTranscriptionProvider`.
- **Falta**: implementar una clase que llame a la API de Whisper (u otro proveedor) recibiendo una URL firmada del archivo en Storage, mapeando su respuesta a `TranscriptResult`. No requiere cambios en el resto de la app: los proyectos ya consumen segmentos con `startSeconds`/`endSeconds`/`confidence`.

## Conexión OAuth con YouTube

- **Modelo de datos**: `media_sources.source_type = 'youtube'`, `integrations.provider = 'youtube'` y `integrations.encrypted_credentials` ya existen.
- **Falta**: flujo OAuth (autorización del canal propio del usuario, nunca descarga no autorizada de videos de terceros), almacenamiento cifrado del refresh token, y un job que extraiga el audio del video del propio canal para transcribirlo con el proveedor anterior.

## Publicación en WordPress / Webflow / Ghost

- **Modelo de datos**: tabla `integrations` con `provider`, `status`, `encrypted_credentials`, `metadata` ya soporta múltiples proveedores por workspace (constraint `unique(workspace_id, provider)`).
- **Falta**: pantalla de conexión (API key o OAuth según el proveedor), cifrado de credenciales en el servidor (nunca en el cliente) y una Server Action `publishDocumentAction` que use `content_html` + `seo_metadata` para crear/actualizar el post remoto.

## Procesamiento en segundo plano

- **Ya existe**: la lógica de negocio de generación vive en `src/lib/generation/pipeline.ts`, desacoplada de la Server Action que la invoca (`src/lib/actions/generation.ts`). `generation_jobs` ya registra `queued/processing/completed/failed` y progreso.
- **Falta**: mover la invocación del pipeline a un worker (cola de Vercel, Supabase Edge Functions con cron, o un servicio como Inngest/Trigger.dev), y que el cliente haga polling o se suscriba a Realtime sobre `generation_jobs` en lugar de esperar la respuesta síncrona de la Server Action.

## Espacios de trabajo con varios usuarios

- **Ya existe**: `workspace_members` con roles (`owner/admin/editor/viewer`) y políticas RLS que ya distinguen permisos por rol en todas las tablas.
- **Falta**: UI para invitar miembros por correo (hoy la pantalla de workspace solo lista a los miembros existentes), un flujo de invitación con token de un solo uso, y notificaciones cuando alguien más edita un documento compartido (hoy el control de concurrencia optimista evita sobrescrituras, pero no hay presencia en tiempo real).

## PWA completa

- **Ya existe**: `manifest.webmanifest`, meta de `viewport`/`themeColor`, diseño responsive en todas las pantallas.
- **Falta**: service worker (offline caching de shell de la app), íconos reales en `public/icons/` (hoy referenciados pero no incluidos), y estrategia de caché para el editor (autosave con cola local cuando no hay conexión).

## Modo oscuro

- **Ya existe**: todas las variables de color en `globals.css` tienen su variante `.dark`.
- **Falta**: un toggle de tema (persistido en cookie o `localStorage`) que añada/quite la clase `dark` en `<html>`; hoy el modo claro es el único activo.
