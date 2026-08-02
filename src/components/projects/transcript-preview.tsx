import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { secondsToTimestamp } from '@/lib/content/metrics';
import type { TranscriptWithSegments } from '@/lib/data/transcripts';
import { OriginalFileLink } from './original-file-link';

export function TranscriptPreview({ transcript }: { transcript: TranscriptWithSegments }) {
  const preview = transcript.segments.slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Transcripción cargada</CardTitle>
          <CardDescription>{transcript.segments.length} segmentos · idioma {transcript.language}</CardDescription>
        </div>
        {transcript.hasOriginalFile && transcript.sourceId && (
          <OriginalFileLink mediaSourceId={transcript.sourceId} />
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {preview.map((segment) => (
          <div key={segment.id} className="flex gap-2 text-sm">
            {segment.startSeconds !== null && (
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {secondsToTimestamp(segment.startSeconds)}
              </span>
            )}
            <p className="text-muted-foreground">
              {segment.speaker && <span className="font-medium text-foreground">{segment.speaker}: </span>}
              {segment.text}
            </p>
          </div>
        ))}
        {transcript.segments.length > preview.length && (
          <p className="text-xs text-muted-foreground">
            + {transcript.segments.length - preview.length} segmentos más. Podrás verlos completos en el editor.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
