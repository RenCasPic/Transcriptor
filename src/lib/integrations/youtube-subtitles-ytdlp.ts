import { spawn as nodeSpawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveYtDlpBinary } from '@/lib/integrations/audio-extractor/ytdlp-binary';
import { ytDlpProxyArgs } from '@/lib/integrations/audio-extractor/ytdlp-extractor';
import { cleanupTempDir, makeTempDir } from '@/lib/media/audio-chunker/ffmpeg';
import {
  fetchYoutubeTranscript,
  timedTextEventsToSegments,
  type TimedTextEvent,
  type YoutubeTranscriptResult,
} from './youtube-transcript';

const SUBTITLES_TIMEOUT_MS = 60_000;
const TITLE_FILE = 'title.txt';

/** Errores de `fetchYoutubeTranscript` que significan "no pude leer subtítulos por mi cuenta" y justifican probar con yt-dlp. */
const RETRY_WITH_YTDLP = new Set(['NO_CAPTIONS', 'EMPTY_TRANSCRIPT', 'TRANSCRIPT_FETCH_PARSE_ERROR']);

/**
 * Elige el archivo de subtítulos a usar entre los descargados por yt-dlp:
 * primero el del idioma pedido, luego su versión "-orig" (subtítulos
 * automáticos del idioma original del video) y, si no, el primero que haya.
 */
export function pickSubtitleFile(files: string[], language: string): string | null {
  const json3 = files.filter((f) => f.endsWith('.json3'));
  const byLang = (suffix: string) => json3.find((f) => f.endsWith(`.${suffix}.json3`));
  const lang = language.toLowerCase().split('-')[0] ?? language;
  return byLang(lang) ?? byLang(`${lang}-orig`) ?? json3[0] ?? null;
}

/**
 * Lee los subtítulos del video con yt-dlp (que sí maneja los tokens que
 * YouTube exige hoy para el endpoint de subtítulos). Con `YTDLP_PROXY` sale por
 * el proxy. Los subtítulos pesan KB, así que el tráfico del proxy es mínimo.
 * Devuelve `null` si el video no tiene subtítulos o yt-dlp no está disponible.
 */
export async function fetchYoutubeTranscriptViaYtDlp(
  videoId: string,
  language: string,
): Promise<YoutubeTranscriptResult | null> {
  const binary = await resolveYtDlpBinary();
  if (!binary) return null;

  const lang = language.toLowerCase().split('-')[0] ?? language;
  const dir = await makeTempDir();
  try {
    const title = await runYtDlpForSubtitles(binary, dir, videoId, `${lang}-orig,${lang}`);
    let files = await readdir(dir);
    let resolvedTitle = title;
    if (!files.some((f) => f.endsWith('.json3'))) {
      // Sin el idioma pedido: se prueba con los subtítulos automáticos del idioma original del video.
      resolvedTitle = (await runYtDlpForSubtitles(binary, dir, videoId, '.*-orig')) || title;
      files = await readdir(dir);
    }

    const file = pickSubtitleFile(files, language);
    if (!file) return null;

    const data = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as { events?: TimedTextEvent[] };
    const segments = timedTextEventsToSegments(data.events ?? []);
    if (segments.length === 0) return null;

    return {
      title: resolvedTitle || 'Video de YouTube',
      fullText: segments.map((s) => s.text).join('\n\n'),
      segments,
    };
  } catch (error) {
    console.error('[youtube] No se pudieron leer los subtítulos con yt-dlp:', error instanceof Error ? error.message : error);
    return null;
  } finally {
    void cleanupTempDir(dir);
  }
}

function runYtDlpForSubtitles(binary: string, dir: string, videoId: string, subLangs: string): Promise<string> {
  return new Promise((resolve) => {
    const args = [
      ...ytDlpProxyArgs(),
      '--no-warnings',
      '--no-playlist',
      '--skip-download',
      '--no-simulate',
      // El título se escribe a un archivo (UTF-8): por stdout, en Windows saldría con la página de códigos local.
      '--print-to-file',
      '%(title)s',
      path.join(dir, TITLE_FILE),
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs',
      subLangs,
      '--sub-format',
      'json3',
      '-o',
      path.join(dir, '%(id)s.%(ext)s'),
      `https://www.youtube.com/watch?v=${videoId}`,
    ];
    const child = nodeSpawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill('SIGKILL'), SUBTITLES_TIMEOUT_MS);
    child.stdout?.on('data', () => undefined);
    child.stderr?.on('data', () => undefined);
    const done = () => {
      clearTimeout(timer);
      void readFile(path.join(dir, TITLE_FILE), 'utf8')
        .then((text) => resolve(text.split(/\r?\n/)[0]?.trim() ?? ''))
        .catch(() => resolve(''));
    };
    child.on('error', done);
    child.on('close', done);
  });
}

/**
 * Subtítulos de un video de YouTube: primero la lectura directa de la página
 * (rápida) y, si YouTube no entrega subtítulos utilizables, yt-dlp. Si
 * tampoco así, se vuelve a lanzar el error original (el llamador decide si
 * cae al audio).
 */
export async function fetchYoutubeTranscriptWithFallback(
  videoId: string,
  language: string,
): Promise<YoutubeTranscriptResult> {
  try {
    return await fetchYoutubeTranscript(videoId, language);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!RETRY_WITH_YTDLP.has(message)) throw error;

    const viaYtDlp = await fetchYoutubeTranscriptViaYtDlp(videoId, language);
    if (viaYtDlp) return viaYtDlp;
    throw error;
  }
}
