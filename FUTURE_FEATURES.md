# Funciones futuras

Marcadas como "Próximamente" en la interfaz actual. La arquitectura ya las contempla en el modelo de datos y en las abstracciones; esto describe qué falta para activarlas.

## Subida de audio/video (implementado)

Ya implementado: pestaña "Video o audio" en la página de proyecto, sube el archivo a Storage y lo transcribe con `WhisperTranscriptionProvider` (`src/lib/ai/transcription/whisper-provider.ts`) a través de la Server Action `transcribeMediaAction` (`src/lib/actions/transcription.ts`). Limitaciones conocidas de esta primera versión:

- **25 MB por archivo** (límite duro de la API de Whisper). No hay compresión ni troceo del lado del servidor.
- **Sin conversión de formato**: se envía el archivo tal cual en los formatos que Whisper acepta de forma nativa (mp4, mov, webm, mp3, wav, m4a). Un `.mov` con un códec poco común podría ser rechazado por la API.
- **Síncrono**: la Server Action espera la respuesta completa de Whisper antes de responder: en archivos largos puede acercarse al timeout de la función serverless (ver "Procesamiento en segundo plano" más abajo).
- **Sin extracción de audio de video**: no se separa la pista de audio antes de enviarla (requeriría ffmpeg); Whisper procesa el contenedor de video completo.

## Importar desde YouTube (implementado, sin OAuth)

Implementado: se pega la URL de cualquier video público de YouTube (propio o ajeno) y `importYoutubeVideoAction` (`src/lib/actions/youtube.ts`) importa sus subtítulos ya existentes como transcripción. Disponible tanto en el Dashboard (`src/components/dashboard/youtube-url-card.tsx`, crea el proyecto y lo importa en un solo paso) como en la pestaña "YouTube" de un proyecto ya creado (`src/components/projects/content-source-panel.tsx`).

**Historia de esta decisión**: la primera versión usaba OAuth (Google Cloud Console + YouTube Data API v3) para conectar el canal propio y descargar sus captions oficialmente — la vía 100% dentro de los Términos de Servicio, pero limitada al propio canal y con una fricción de configuración considerable (crear proyecto en Google Cloud, pantalla de consentimiento, credenciales). Por decisión explícita del usuario se reemplazó por completo por el enfoque actual, mucho más simple de usar.

**Cómo funciona ahora** (`src/lib/integrations/youtube-transcript.ts`): no usa la Data API oficial (que de todas formas no permite descargar video/audio, ni siquiera del propio canal). En su lugar, lee la página pública del video igual que lo hace el reproductor web de YouTube, extrae la lista de pistas de subtítulos embebida en el HTML, y descarga la pista elegida desde su `baseUrl` (`timedtext`). Es un endpoint interno/no documentado, no la API oficial — funciona con cualquier video público con subtítulos, es gratis, pero **YouTube puede cambiarlo o bloquearlo sin aviso** (mismo trade-off que herramientas como `youtube-transcript`/`youtube-transcript-api`). Trade-off aceptado explícitamente para evitar la fricción de OAuth.

**Limitaciones conocidas**:
- Si el video no tiene subtítulos en absoluto (ni manuales ni generados automáticamente), la importación falla con un mensaje explícito; no hay fallback automático a Whisper (no se descarga audio/video, ver arriba).
- Sujeto a que YouTube no cambie el formato interno de la página o del endpoint `timedtext`; si eso ocurre, `fetchYoutubeTranscript` empezará a fallar hasta que se actualice el parseo.
- No requiere autenticación del usuario ni límite por canal — el rate limit es por usuario de la app (`checkRateLimit`), no por canal de YouTube.

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
