# Decisiones de arquitectura

## 1. Next.js App Router + Server Actions como capa de negocio

Toda escritura (crear proyecto, importar transcripción, generar artículo, guardar documento, reescribir sección, etc.) pasa por Server Actions en `src/lib/actions/*`, no por Route Handlers ni por llamadas directas desde el cliente a Supabase para operaciones sensibles. Esto permite:

- Nunca exponer `SUPABASE_SERVICE_ROLE_KEY` ni claves de proveedores de IA al navegador.
- Validar con Zod en el servidor antes de tocar la base de datos, incluso si el formulario del cliente ya valida.
- Devolver siempre `ActionResult<T>` (`{success:true,data}` o `{success:false,error:{code,message}}`), consistente en toda la app.

Las lecturas usan Server Components (`src/lib/data/*`) que llaman al cliente Supabase con la sesión del usuario, apoyándose en RLS para la autorización — no hay lógica de autorización duplicada en la aplicación.

## 2. Separación proveedor de IA / lógica de negocio / transporte

Tres capas independientes:

1. **Proveedores** (`src/lib/ai/provider.ts` + `src/lib/ai/providers/*`): implementan `ContentGenerationProvider` y `TranscriptionProvider`. `GenericContentGenerationProvider` habla con OpenAI / Anthropic / Groq vía `fetch` (sin SDKs) a través de un `ModelCaller` por proveedor; los proveedores de transcripción (`GroqTranscriptionProvider`, `WhisperTranscriptionProvider`) igual. El proveedor activo se resuelve por variable de entorno (`AI_PROVIDER`, default `openai`/`gpt-4o-mini` / `TRANSCRIPTION_PROVIDER`) en `src/lib/ai/providers/index.ts` y `src/lib/ai/transcription/index.ts`. Si falta la API key, la fábrica lanza `AiNotConfiguredError` / `TranscriptionNotConfiguredError`, que la capa de acciones traduce a un `ActionResult` de error accionable — no hay proveedor "mock" ni transcripción de ejemplo. Los errores del proveedor (401, 429, 413, 5xx, cuota…) se clasifican en `src/lib/ai/errors.ts` (`classifyAiError`) a un conjunto pequeño de códigos accionables, usados por igual desde `generateArticleAction` y el procesador de jobs; `postWithRetry` reintenta 429/5xx respetando `retry-after`. El prompt referencia los segmentos por índice (`s0`, `s1`…) en vez de por UUID para ahorrar tokens, y el proveedor los retraduce antes de devolver el artículo (`remapSegmentRefs`).
2. **Pipeline de negocio** (`src/lib/generation/pipeline.ts`): implementa los 11 pasos del flujo de generación (validar transcripción → normalizar → segmentar → estructurar → redactar → SEO → alertas → relacionar fuentes → guardar documento → crear versión → cambiar estado del proyecto). Recibe un cliente Supabase inyectado, no crea el suyo — así puede ejecutarse igual desde una Server Action (hoy) o desde un worker en segundo plano (futuro) sin cambios.
3. **Transporte** (`src/lib/actions/generation.ts`): la Server Action que expone el pipeline a la UI. Aquí vive el rate limiting, el registro en `generation_jobs` y la traducción de errores a mensajes en español.

### Generación de artículos en varias etapas (transcripciones largas)

`GenericContentGenerationProvider.generateArticle` bifurca según el número de segmentos:

- **≤ `AI_SINGLE_PASS_MAX_SEGMENTS` (~70):** una sola llamada (`buildArticlePrompt`).
- **Más:** gpt-4o-mini comprime una transcripción larga en un resumen corto aunque le quepa en contexto, así que se hace: (1) **extracción** de notas por bloques de segmentos, en paralelo (`buildExtractionPrompt`, sin resumir); (2) **esqueleto** — agrupar las notas en secciones (`buildOutlinePrompt`); (3) **redacción por sección**, una llamada acotada por sección en paralelo (`buildSectionPrompt`) — al ser una tarea pequeña el modelo la desarrolla a fondo; (4) **metadatos** (`buildArticleMetaPrompt`); (5) **ensamblado** local. Los `sourceSegmentIds` de cada bloque se calculan de forma determinista a partir de los `noteRefs` que devuelve el modelo → notas → etiquetas `s{index}` → UUID (`remapSegmentRefs`). Cada etapa reintenta y tiene un fallback (notas crudas / párrafo con las notas / SEO mínimo) para no perder contenido ni romper el esquema.

Efecto: la longitud del artículo es proporcional a la riqueza de la conversación (un audio de 26 min ≈ 4.5-6k palabras) en vez de un resumen fijo de ~600. Las páginas que disparan `generateArticleAction` declaran `export const maxDuration = 300`.

## 3. Prompts versionados y separados por operación

`src/lib/prompts/` tiene un archivo por operación (estructura, artículo, reescritura, SEO, detección de afirmaciones, relación con fuentes) más un `rules.ts` con las reglas comunes (no inventar datos, señalar incertidumbre, respetar idioma/tono/audiencia). Cambiar una regla de política en un solo lugar la propaga a todos los prompts. El paso de "creación de estructura" tiene su propio prompt listo (`structure.ts`) aunque el pipeline actual genera estructura + redacción en una sola llamada por simplicidad y costo — separarlo en dos llamadas es un cambio aislado al pipeline, no a los proveedores.

## 4. Fidelidad a la fuente como ciudadano de primera clase

- Cada bloque del artículo (`ArticleNode`) lleva `sourceSegmentIds`, que se persisten como filas en `content_source_links`.
- El esquema de salida de la IA se valida con Zod (`GeneratedArticleSchema`) antes de guardar nada: si el proveedor no devuelve la forma esperada, la generación falla explícitamente en lugar de guardar datos corruptos.
- Las alertas (`content_warnings`) son un tipo de dato de primera clase, no una anotación de texto: tienen tipo, estado (`open/reviewed/resolved/dismissed`) y se resuelven con una Server Action propia.
- El documento ProseMirror usa un atributo `blockId` (extensión TipTap `BlockId`, `src/lib/editor/block-id-extension.ts`) para poder relacionar cualquier bloque con sus fuentes y alertas incluso después de que el usuario lo edite.

## 5. Autosave con concurrencia optimista

`content_documents.version` es un contador entero. `saveDocumentAction` exige `expectedVersion` y hace `update ... where id = X and version = expectedVersion`; si otra pestaña ya guardó una versión más nueva, la actualización afecta 0 filas y la acción devuelve `VERSION_CONFLICT`. Es una alternativa simple a timestamps o ETags que no requiere columnas adicionales y es fácil de razonar.

## 6. RLS como única fuente de autorización

No existe una capa de permisos en la aplicación aparte de RLS. Todas las políticas se apoyan en dos funciones `SECURITY DEFINER`: `is_workspace_member` / `has_workspace_role` (para tablas colgadas de `workspaces`) y sus equivalentes `is_project_member` / `can_edit_project` / `is_document_member` / `can_edit_document` (para tablas colgadas de `projects` o `content_documents`). Esto evita duplicar la cadena de joins en cada política y evita la recursión de RLS que ocurriría si `workspace_members` intentara consultarse a sí misma directamente en su propia política.

`src/lib/permissions.ts` refleja las mismas reglas en el cliente **solo para decisiones de UI** (mostrar/ocultar botones); la autorización real siempre la garantiza Postgres.

## 7. Sanitización de HTML en el borde de escritura

`content_html` se sanitiza con `isomorphic-dompurify` dentro de `saveDocumentAction`, con una lista blanca de tags/atributos, antes de persistirse. El contenido ya sanitizado es lo único que se renderiza con `dangerouslySetInnerHTML` (comparador de versiones, meta description preview), por lo que nunca se inyecta HTML no confiable.

## 8. Rate limiting en memoria (limitación conocida)

`src/lib/rate-limit.ts` implementa una ventana deslizante en memoria de proceso. Es suficiente para una sola instancia (el caso típico de un MVP en Vercel con una función), pero **no se comparte entre instancias/regiones**. Para producción con tráfico real, sustituir por un store compartido (Upstash Redis, Vercel KV) manteniendo la misma firma `checkRateLimit(key, limit, windowSeconds)`.

## 9. CSRF, límites de tamaño y validación de entrada

- **CSRF**: todas las escrituras pasan por Server Actions de Next.js, que desde la versión 14 verifican automáticamente que el header `Origin` de la petición coincida con el host de la app antes de ejecutar la acción — no se necesita un token CSRF manual adicional.
- **Validación de entrada**: cada Server Action valida su input con Zod (`src/lib/validations/*`) antes de tocar la base de datos, aunque el formulario del cliente ya haya validado con el mismo esquema (`@hookform/resolvers/zod`).
- **Límites de tamaño**: transcripciones pegadas manualmente se limitan a 200.000 caracteres (`src/lib/actions/projects.ts`); los archivos subidos se limitan a 5 MB en el cliente y a 25 MB / tipos MIME específicos a nivel del bucket de Storage (`supabase/migrations/0015_storage.sql`), que es la validación que realmente importa porque no depende de que el cliente se comporte bien.
- **Archivos privados**: el bucket `project-sources` no es público; el único acceso de lectura es a través de `getMediaSourceSignedUrlAction` (`src/lib/actions/storage.ts`), que genera una URL firmada de 60 segundos usando la sesión del usuario (no la service role key), por lo que además queda sujeta a las políticas RLS de `storage.objects`.

## 10. Stack de UI

- **shadcn/ui**: los componentes viven en `src/components/ui` como código propio (no una dependencia de node_modules), siguiendo la convención shadcn — se pueden modificar libremente.
- **TipTap**: elegido sobre editores basados en `contentEditable` puro por su modelo ProseMirror (permite atributos custom como `blockId`) y su ecosistema de extensiones (Link, Placeholder, BubbleMenu para el menú de acciones de IA).
- **Tailwind con variables CSS HSL** (`src/app/globals.css`): permite alternar modo claro/oscuro cambiando solo las variables, sin duplicar clases condicionales en cada componente.

## 11. Por qué el flujo de generación es una Server Action y no una cola

El brief pide una arquitectura preparada para procesamiento en segundo plano, pero el MVP ejecuta la generación de forma síncrona dentro de una Server Action. Se decidió así porque:

- Las llamadas a Groq/Anthropic/OpenAI para un artículo típico responden en segundos, no minutos — aceptable dentro del timeout de una función serverless.
- Separar completamente la lógica de negocio (`src/lib/generation/pipeline.ts`) del transporte significa que mover esto a un worker (Inngest, un cron de Supabase Edge Functions, una cola de Vercel) es un cambio de **dónde se invoca** la función, no de **cómo funciona**.
- La tabla `generation_jobs` ya existe y se puebla en cada generación. Hoy la Server Action inserta el job directamente en `processing` (porque se ejecuta y resuelve en la misma invocación) y lo actualiza a `completed`/`failed` al terminar; el estado `queued` ya está contemplado en el check constraint para cuando un worker en segundo plano encole el trabajo antes de procesarlo. El front-end ya puede leer `generation_jobs` para mostrar progreso y no necesitará cambios de esquema cuando la ejecución se mueva a segundo plano.

## 12. Archivos de audio/video grandes: Storage directo + job asíncrono + troceado

El flujo de un archivo de medios es:

`navegador [extrae audio con ffmpeg.wasm] → Supabase Storage (signed upload URL) → generation_jobs (queued) → runTranscriptionJob → [trocear si aún excede el límite del proveedor → transcribir chunks → recomponer] → saveTranscript → runArticleGenerationPipeline → completed/failed`

Decisiones:

- **Extracción de audio EN EL NAVEGADOR antes de subir** (`src/lib/media/extract-audio-client.ts`). El límite de subida a Supabase Storage lo fija el plan del proyecto (50 MB en el gratuito, no configurable). Para que un podcast/video de 40-50 min quepa, el navegador transcodifica cualquier medio a MP3 mono 16 kHz / 32 kbps con **ffmpeg.wasm** (core de ~32 MB servido desde `/public/ffmpeg/`, copiado por `scripts/setup-ffmpeg-assets.mjs`). El archivo de entrada se monta vía WORKERFS (lectura perezosa del Blob, sin cargarlo entero en memoria). El audio pequeño se salta este paso. Si ffmpeg.wasm falla y el original ya cabe, se sube tal cual; si no, error explícito. El deploy objetivo es Vercel: este enfoque no depende del host y no consume su límite de body porque la subida va directa a Storage.
- **La subida no pasa por una Server Action.** `createMediaUploadUrlAction` solo devuelve una _signed upload URL_ con la ruta del objeto elegida por el servidor (`{workspace_id}/{project_id}/{uuid}.{ext}`); el navegador hace `PUT` directo a Storage (con barra de progreso vía XHR). La Server Action de "encolar" (`enqueueMediaTranscriptionAction`) recibe solo la ruta y re-valida en servidor: prefijo de la ruta (ownership), existencia real del objeto, tamaño y formato. Así se elimina la dependencia del `bodySizeLimit` de Next.js.
- **RLS sigue siendo la única autorización.** La creación de la signed upload URL, el `insert` en `media_sources` y en `generation_jobs` pasan por las políticas del usuario. El procesamiento en segundo plano usa el cliente admin (el job ya fue autorizado al encolarse) — mismo criterio que `src/lib/supabase/admin.ts` documenta para tareas internas.
- **`runTranscriptionJob` (`src/lib/generation/transcription-pipeline.ts`) es lógica de negocio pura**, igual que `runArticleGenerationPipeline`: recibe el cliente Supabase y sus dependencias inyectadas (proveedor, troceador, límites, `fetch`, `saveTranscript`, generación). No sabe si lo invoca `after()` (hoy) o un worker/cron (`POST /api/jobs/transcription`, drena `queued` y retoma `processing` colgados). El pipeline de generación de artículos **no cambió**: recibe una transcripción ya guardada como cualquier otra.
- **Los límites del proveedor los declara el proveedor** (`TranscriptionProvider.limits`: `maxRequestBytes`, `supportsChunking`), no el pipeline. El procesador compara el tamaño del audio contra `provider.limits.maxRequestBytes` y decide pasada única vs. troceado.
- **Troceado con ffmpeg** (`src/lib/media/audio-chunker/`, binarios estáticos de `@ffmpeg-installer`): vuelca el stream a un archivo temporal en disco (no en RAM), extrae audio mono y lo segmenta por tiempo; solo un chunk (~pocos MB) está en memoria a la vez. `mergeChunkTranscripts` (`src/lib/media/merge-transcripts.ts`) suma el offset de cada chunk a sus timestamps y reindexa los segmentos de forma correlativa, de modo que `transcript_segments.segment_index` y la trazabilidad bloque→segmento del artículo funcionan igual que con una transcripción de una sola pasada. Si ffmpeg no está disponible y el archivo excede el límite, el job falla con `MEDIA_REQUIRES_CHUNKING_UNAVAILABLE` (explícito y recuperable) en vez de reventar a mitad.
- **Todos los límites son configurables** (`getMediaLimits()`, `src/lib/media/limits.ts`): `MEDIA_MAX_SOURCE_MB` (lo que el usuario elige), `MEDIA_MAX_UPLOAD_MB` (lo que se sube tras extraer), `MEDIA_CLIENT_EXTRACT_THRESHOLD_MB`, `MEDIA_MAX_DURATION_SECONDS`, `MEDIA_CHUNK_*`. El límite de 25 MB por petición del proveedor es una constante del servicio (`PROVIDER_REQUEST_MAX_BYTES`), no una variable de entorno.
