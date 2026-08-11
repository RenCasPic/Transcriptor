/**
 * Extracción de subtítulos de YouTube sin OAuth ni la Data API oficial.
 *
 * YouTube no expone en su API pública un endpoint para descargar el
 * video/audio, y la Data API v3 solo permite descargar captions con OAuth
 * del dueño del canal (ver el flujo anterior, reemplazado por decisión
 * explícita del usuario). Este módulo en cambio replica lo que hace el
 * reproductor web de YouTube: lee la página del video, extrae la lista de
 * pistas de subtítulos embebida en el HTML (`captionTracks`) y descarga la
 * pista elegida desde su `baseUrl` (`timedtext`).
 *
 * Es un endpoint interno/no documentado, no la API oficial: funciona hoy,
 * es gratis y funciona con cualquier video público con subtítulos (propios o
 * ajenos), pero YouTube puede cambiarlo o bloquearlo sin aviso. Trade-off
 * aceptado explícitamente para evitar la fricción de configurar OAuth.
 */

const PATHNAME_ID_PATTERNS = [/^\/shorts\/([^/]+)/, /^\/embed\/([^/]+)/, /^\/live\/([^/]+)/];

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** Valida que un string tenga la forma exacta de un ID de video de YouTube (11 caracteres del charset base64url). */
export function isValidYoutubeVideoId(id: string): boolean {
  return YOUTUBE_VIDEO_ID_PATTERN.test(id);
}

/**
 * Extrae el ID de video de las formas más comunes de URL de YouTube.
 * Devuelve null si no reconoce el formato o si lo que extrajo no tiene la
 * forma de un ID de video real (evita propagar basura a los módulos que
 * reconstruyen una URL canónica a partir de este valor, como el extractor
 * de audio).
 */
export function extractYoutubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  let candidate: string | null = null;

  if (hostname === 'youtu.be') {
    candidate = url.pathname.slice(1).split('/')[0] || null;
  } else if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
    if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v');
    } else {
      for (const pattern of PATHNAME_ID_PATTERNS) {
        const match = url.pathname.match(pattern);
        if (match?.[1]) {
          candidate = match[1];
          break;
        }
      }
    }
  }

  return candidate && isValidYoutubeVideoId(candidate) ? candidate : null;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

function extractCaptionTracks(html: string): CaptionTrack[] {
  const marker = '"captionTracks":';
  const startIndex = html.indexOf(marker);
  if (startIndex === -1) return [];

  const arrayStart = html.indexOf('[', startIndex);
  if (arrayStart === -1) return [];

  let depth = 0;
  let endIndex = -1;
  for (let i = arrayStart; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') {
      depth--;
      if (depth === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }
  if (endIndex === -1) return [];

  try {
    return JSON.parse(html.slice(arrayStart, endIndex)) as CaptionTrack[];
  } catch {
    return [];
  }
}

function extractVideoTitle(html: string): string {
  const match = html.match(/<title>(.*?)<\/title>/s);
  if (!match?.[1]) return 'Video de YouTube';
  return match[1]
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s*-\s*YouTube\s*$/, '')
    .trim();
}

/** Prioriza subtítulos manuales del idioma pedido; si no, cualquier manual; si no, ASR del idioma; si no, la primera pista. */
function selectCaptionTrack(tracks: CaptionTrack[], preferredLanguage: string): CaptionTrack | null {
  if (tracks.length === 0) return null;

  const langPrefix = preferredLanguage.slice(0, 2).toLowerCase();
  const matchesLang = (t: CaptionTrack) => t.languageCode.toLowerCase().startsWith(langPrefix);
  const manual = tracks.filter((t) => t.kind !== 'asr');

  return manual.find(matchesLang) ?? manual[0] ?? tracks.find(matchesLang) ?? tracks[0] ?? null;
}

interface TimedTextEvent {
  tStartMs: number;
  dDurationMs?: number;
  segs?: Array<{ utf8?: string }>;
}

export interface YoutubeTranscriptSegment {
  index: number;
  speaker: null;
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface YoutubeTranscriptResult {
  title: string;
  fullText: string;
  segments: YoutubeTranscriptSegment[];
}

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function fetchYoutubeTranscript(
  videoId: string,
  preferredLanguage: string,
): Promise<YoutubeTranscriptResult> {
  const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=${preferredLanguage}`, {
    headers: { 'user-agent': BROWSER_USER_AGENT, 'accept-language': preferredLanguage },
  });
  if (!pageResponse.ok) {
    throw new Error(`YOUTUBE_PAGE_FETCH_ERROR:${pageResponse.status}`);
  }
  const html = await pageResponse.text();

  const tracks = extractCaptionTracks(html);
  const track = selectCaptionTrack(tracks, preferredLanguage);
  if (!track) {
    throw new Error('NO_CAPTIONS');
  }

  const timedTextUrl = new URL(track.baseUrl);
  timedTextUrl.searchParams.set('fmt', 'json3');

  const transcriptResponse = await fetch(timedTextUrl.toString(), {
    headers: { 'user-agent': BROWSER_USER_AGENT },
  });
  if (!transcriptResponse.ok) {
    throw new Error(`YOUTUBE_TRANSCRIPT_FETCH_ERROR:${transcriptResponse.status}`);
  }

  // YouTube a veces responde 200 OK con el cuerpo vacío para una pista de
  // subtítulos que en teoría existe (idiomas auto-traducidos, cambios en su
  // endpoint interno, etc.) — response.json() en ese caso lanza
  // "Unexpected end of JSON input". Se trata igual que "sin subtítulos
  // utilizables" en vez de dejar escapar el SyntaxError crudo.
  let data: { events?: TimedTextEvent[] };
  try {
    data = (await transcriptResponse.json()) as { events?: TimedTextEvent[] };
  } catch {
    throw new Error('TRANSCRIPT_FETCH_PARSE_ERROR');
  }
  const segments: YoutubeTranscriptSegment[] = [];

  for (const event of data.events ?? []) {
    const text = (event.segs ?? [])
      .map((seg) => seg.utf8 ?? '')
      .join('')
      .replace(/\n/g, ' ')
      .trim();
    if (!text) continue;

    segments.push({
      index: segments.length,
      speaker: null,
      startSeconds: event.tStartMs / 1000,
      endSeconds: (event.tStartMs + (event.dDurationMs ?? 0)) / 1000,
      text,
    });
  }

  if (segments.length === 0) {
    throw new Error('EMPTY_TRANSCRIPT');
  }

  return {
    title: extractVideoTitle(html),
    fullText: segments.map((s) => s.text).join('\n\n'),
    segments,
  };
}
