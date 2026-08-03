/**
 * Cliente de la YouTube Data API v3 y del endpoint OAuth de Google, vía
 * `fetch` puro (sin SDK de Google, igual que los proveedores de IA en
 * `src/lib/ai/providers`). Cubre únicamente lo que la API oficial permite:
 * metadata del canal/videos propios y descarga de captions ya existentes.
 * NO existe (ni se implementa aquí) forma oficial de descargar el video o
 * audio real de un video, ni siquiera del propio canal autenticado.
 */

const GOOGLE_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';

function getRedirectUri(): string {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  return `${appUrl}/api/integrations/youtube/callback`;
}

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('YOUTUBE_OAUTH_NOT_CONFIGURED');
  }
  return { clientId, clientSecret };
}

export function buildYoutubeAuthUrl(state: string): string {
  const { clientId } = getClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: YOUTUBE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${GOOGLE_OAUTH_AUTH_URL}?${params.toString()}`;
}

export interface YoutubeTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

export async function exchangeYoutubeCode(code: string): Promise<YoutubeTokens> {
  const { clientId, clientSecret } = getClientCredentials();
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    throw new Error(`YOUTUBE_OAUTH_TOKEN_ERROR:${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in,
  };
}

export async function refreshYoutubeAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const { clientId, clientSecret } = getClientCredentials();
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`YOUTUBE_OAUTH_REFRESH_ERROR:${response.status}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

async function youtubeApiGet(path: string, accessToken: string): Promise<unknown> {
  const response = await fetch(`${YOUTUBE_API_BASE}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`YOUTUBE_API_ERROR:${response.status}`);
  }
  return response.json();
}

export interface YoutubeOwnChannel {
  channelId: string;
  channelTitle: string;
  uploadsPlaylistId: string;
}

export async function fetchOwnChannel(accessToken: string): Promise<YoutubeOwnChannel> {
  const data = (await youtubeApiGet('/channels?part=snippet,contentDetails&mine=true', accessToken)) as {
    items?: Array<{
      id: string;
      snippet?: { title?: string };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  };

  const channel = data.items?.[0];
  const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (!channel || !uploadsPlaylistId) {
    throw new Error('YOUTUBE_NO_CHANNEL_FOUND');
  }

  return {
    channelId: channel.id,
    channelTitle: channel.snippet?.title ?? 'Canal de YouTube',
    uploadsPlaylistId,
  };
}

export interface YoutubeVideo {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string;
}

export interface YoutubeVideoPage {
  videos: YoutubeVideo[];
  nextPageToken: string | null;
}

export async function fetchChannelVideos(
  accessToken: string,
  uploadsPlaylistId: string,
  pageToken?: string,
): Promise<YoutubeVideoPage> {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: '25',
  });
  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const data = (await youtubeApiGet(`/playlistItems?${params.toString()}`, accessToken)) as {
    items?: Array<{
      contentDetails?: { videoId?: string; videoPublishedAt?: string };
      snippet?: { title?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string }> };
    }>;
    nextPageToken?: string;
  };

  const videos: YoutubeVideo[] = (data.items ?? [])
    .filter((item) => item.contentDetails?.videoId)
    .map((item) => ({
      videoId: item.contentDetails!.videoId!,
      title: item.snippet?.title ?? 'Video sin título',
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
      publishedAt: item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt ?? '',
    }));

  return { videos, nextPageToken: data.nextPageToken ?? null };
}

export interface YoutubeCaptionTrack {
  captionId: string;
  language: string;
  isAsr: boolean;
}

export async function fetchCaptionTracks(accessToken: string, videoId: string): Promise<YoutubeCaptionTrack[]> {
  const data = (await youtubeApiGet(`/captions?part=snippet&videoId=${videoId}`, accessToken)) as {
    items?: Array<{ id: string; snippet?: { language?: string; trackKind?: string } }>;
  };

  return (data.items ?? []).map((item) => ({
    captionId: item.id,
    language: item.snippet?.language ?? 'und',
    isAsr: item.snippet?.trackKind === 'ASR',
  }));
}

/** Elige la mejor pista disponible: prioriza subtítulos manuales del idioma pedido, luego cualquier manual, luego ASR. */
export function selectCaptionTrack(
  tracks: YoutubeCaptionTrack[],
  preferredLanguage: string,
): YoutubeCaptionTrack | null {
  if (tracks.length === 0) return null;

  const langPrefix = preferredLanguage.slice(0, 2).toLowerCase();
  const matchesLang = (t: YoutubeCaptionTrack) => t.language.toLowerCase().startsWith(langPrefix);

  const manual = tracks.filter((t) => !t.isAsr);
  return (
    manual.find(matchesLang) ??
    manual[0] ??
    tracks.find(matchesLang) ??
    tracks[0] ??
    null
  );
}

export async function downloadCaptionTrack(accessToken: string, captionId: string): Promise<string> {
  const response = await fetch(`${YOUTUBE_API_BASE}/captions/${captionId}?tfmt=srt`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`YOUTUBE_API_ERROR:${response.status}`);
  }
  return response.text();
}
