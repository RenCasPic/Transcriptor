/**
 * Normalización de transcripciones en texto plano, SRT y VTT hacia un formato
 * común de segmentos con timestamps opcionales. La normalización nunca altera
 * el contenido semántico del texto (no resume ni reescribe), solo limpia
 * espacios, saltos de línea y metadatos de formato.
 */

export interface NormalizedSegment {
  index: number;
  speaker: string | null;
  startSeconds: number | null;
  endSeconds: number | null;
  text: string;
}

export interface NormalizedTranscript {
  fullText: string;
  segments: NormalizedSegment[];
}

const SPEAKER_PATTERN = /^\s*([A-ZÁÉÍÓÚÑ][\w .'-]{1,40}):\s*(.*)$/;

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractSpeaker(rawText: string): { speaker: string | null; text: string } {
  const match = rawText.match(SPEAKER_PATTERN);
  if (match?.[1] && match[2]) {
    return { speaker: match[1].trim(), text: cleanText(match[2]) };
  }
  return { speaker: null, text: cleanText(rawText) };
}

/** Divide texto plano pegado manualmente o importado desde TXT en párrafos/segmentos. */
export function normalizePlainText(raw: string): NormalizedTranscript {
  const paragraphs = raw
    .replace(/\r\n/g, '\n')
    .split(/\n{1,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const segments: NormalizedSegment[] = paragraphs.map((paragraph, i) => {
    const { speaker, text } = extractSpeaker(paragraph);
    return { index: i, speaker, startSeconds: null, endSeconds: null, text };
  });

  return { fullText: segments.map((s) => s.text).join('\n\n'), segments };
}

function timeToSeconds(time: string): number {
  // Soporta "HH:MM:SS,mmm" (SRT) y "HH:MM:SS.mmm" (VTT)
  const normalized = time.replace(',', '.');
  const [h, m, s] = normalized.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

/** Parsea un archivo SRT en segmentos con timestamps. */
export function normalizeSrt(raw: string): NormalizedTranscript {
  const blocks = raw
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean);

  const segments: NormalizedSegment[] = [];

  blocks.forEach((block) => {
    const lines = block.split('\n').filter(Boolean);
    const timeLineIndex = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIndex === -1) return;

    const [startRaw, endRaw] = lines[timeLineIndex]!.split('-->').map((s) => s.trim());
    const textLines = lines.slice(timeLineIndex + 1);
    if (textLines.length === 0 || !startRaw || !endRaw) return;

    const { speaker, text } = extractSpeaker(textLines.join(' '));
    if (!text) return;

    segments.push({
      index: segments.length,
      speaker,
      startSeconds: timeToSeconds(startRaw),
      endSeconds: timeToSeconds(endRaw),
      text,
    });
  });

  return { fullText: segments.map((s) => s.text).join('\n\n'), segments };
}

/** Parsea un archivo WebVTT en segmentos con timestamps (ignora cabecera WEBVTT y cues sin texto). */
export function normalizeVtt(raw: string): NormalizedTranscript {
  const withoutHeader = raw.replace(/\r\n/g, '\n').replace(/^WEBVTT.*\n/, '');
  const blocks = withoutHeader.trim().split(/\n\s*\n/).filter(Boolean);

  const segments: NormalizedSegment[] = [];

  blocks.forEach((block) => {
    const lines = block.split('\n').filter(Boolean);
    const timeLineIndex = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIndex === -1) return;

    const [startRaw, endRaw] = lines[timeLineIndex]!.split('-->').map((s) => s.trim().split(' ')[0] ?? '');
    const textLines = lines.slice(timeLineIndex + 1);
    if (textLines.length === 0 || !startRaw || !endRaw) return;

    const { speaker, text } = extractSpeaker(textLines.join(' '));
    if (!text) return;

    segments.push({
      index: segments.length,
      speaker,
      startSeconds: timeToSeconds(startRaw),
      endSeconds: timeToSeconds(endRaw),
      text,
    });
  });

  return { fullText: segments.map((s) => s.text).join('\n\n'), segments };
}

export type TranscriptSourceKind = 'manual' | 'txt' | 'srt' | 'vtt';

export function normalizeTranscript(raw: string, kind: TranscriptSourceKind): NormalizedTranscript {
  switch (kind) {
    case 'srt':
      return normalizeSrt(raw);
    case 'vtt':
      return normalizeVtt(raw);
    case 'txt':
    case 'manual':
    default:
      return normalizePlainText(raw);
  }
}
