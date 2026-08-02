'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Upload, Sparkles, Youtube, Film } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { importTranscriptAction } from '@/lib/actions/projects';
import { transcribeMediaAction } from '@/lib/actions/transcription';
import { createClient } from '@/lib/supabase/client';
import { DEMO_TRANSCRIPT_TEXT } from '@/lib/content/demo-transcript';

const MAX_TEXT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_MEDIA_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const EXTENSION_TO_SOURCE: Record<string, 'txt' | 'srt' | 'vtt'> = {
  txt: 'txt',
  srt: 'srt',
  vtt: 'vtt',
};

const MEDIA_EXTENSION_TO_TYPE: Record<string, 'video' | 'audio'> = {
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
};

export function ContentSourcePanel({
  projectId,
  workspaceId,
  language,
}: {
  projectId: string;
  workspaceId: string;
  language: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  async function handleImport(params: {
    sourceType: 'manual' | 'txt' | 'srt' | 'vtt';
    text: string;
    originalFilename?: string;
    storagePath?: string;
  }) {
    setIsSubmitting(true);
    const result = await importTranscriptAction({
      projectId,
      sourceType: params.sourceType,
      text: params.text,
      originalFilename: params.originalFilename,
      storagePath: params.storagePath,
      language,
    });
    setIsSubmitting(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    toast.success('Transcripción importada correctamente');
    router.refresh();
  }

  async function handlePasteSubmit() {
    await handleImport({ sourceType: 'manual', text: pastedText });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const sourceType = EXTENSION_TO_SOURCE[extension];
    if (!sourceType) {
      toast.error('Formato no soportado. Usa un archivo .txt, .srt o .vtt');
      return;
    }
    if (file.size > MAX_TEXT_FILE_SIZE_BYTES) {
      toast.error('El archivo supera el tamaño máximo permitido (5 MB)');
      return;
    }

    setIsSubmitting(true);
    try {
      const text = await file.text();
      const storagePath = `${workspaceId}/${projectId}/${Date.now()}-${file.name}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from('project-sources')
        .upload(storagePath, file, { contentType: file.type || 'text/plain' });

      if (uploadError) {
        toast.error('No se pudo guardar el archivo original, pero se procesará su contenido.');
      }

      await handleImport({
        sourceType,
        text,
        originalFilename: file.name,
        storagePath: uploadError ? undefined : storagePath,
      });
    } catch {
      toast.error('No se pudo leer el archivo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMediaFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const mediaType = MEDIA_EXTENSION_TO_TYPE[extension];
    if (!mediaType) {
      toast.error('Formato no soportado. Usa .mp4, .mov, .webm, .mp3, .wav o .m4a');
      return;
    }
    if (file.size > MAX_MEDIA_FILE_SIZE_BYTES) {
      toast.error('El archivo supera el tamaño máximo permitido para transcribir (25 MB)');
      return;
    }

    setIsTranscribing(true);
    try {
      const storagePath = `${workspaceId}/${projectId}/${Date.now()}-${file.name}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from('project-sources')
        .upload(storagePath, file, { contentType: file.type || 'application/octet-stream' });

      if (uploadError) {
        toast.error('No se pudo subir el archivo. Inténtalo de nuevo.');
        return;
      }

      const result = await transcribeMediaAction({
        projectId,
        sourceType: mediaType,
        storagePath,
        originalFilename: file.name,
        language,
      });

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      toast.success('Transcripción completada');
      router.refresh();
    } catch {
      toast.error('No se pudo procesar el archivo.');
    } finally {
      setIsTranscribing(false);
    }
  }

  async function handleUseDemo() {
    await handleImport({ sourceType: 'manual', text: DEMO_TRANSCRIPT_TEXT });
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="paste">
        <TabsList>
          <TabsTrigger value="paste">Pegar texto</TabsTrigger>
          <TabsTrigger value="upload">Subir archivo</TabsTrigger>
          <TabsTrigger value="media">Video o audio</TabsTrigger>
          <TabsTrigger value="demo">Usar demo</TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="space-y-3">
          <Textarea
            rows={8}
            placeholder="Pega aquí la transcripción de tu video, podcast o entrevista..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
          <Button onClick={handlePasteSubmit} disabled={isSubmitting || pastedText.trim().length < 20}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Usar esta transcripción
          </Button>
        </TabsContent>

        <TabsContent value="upload" className="space-y-3">
          <p className="text-sm text-muted-foreground">Formatos soportados: .txt, .srt, .vtt (máx. 5 MB)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.srt,.vtt"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Seleccionar archivo
          </Button>
        </TabsContent>

        <TabsContent value="media" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Formatos soportados: .mp4, .mov, .webm, .mp3, .wav, .m4a (máx. 25 MB). La transcripción puede
            tardar uno o dos minutos según la duración del archivo.
          </p>
          <input
            ref={mediaInputRef}
            type="file"
            accept=".mp4,.mov,.webm,.mp3,.wav,.m4a"
            className="hidden"
            onChange={handleMediaFileChange}
          />
          <Button
            variant="outline"
            onClick={() => mediaInputRef.current?.click()}
            disabled={isTranscribing}
          >
            {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            {isTranscribing ? 'Transcribiendo...' : 'Seleccionar video o audio'}
          </Button>
        </TabsContent>

        <TabsContent value="demo" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Prueba el flujo completo con una transcripción de ejemplo, sin necesidad de subir nada.
          </p>
          <Button onClick={handleUseDemo} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Usar transcripción de demostración
          </Button>
        </TabsContent>
      </Tabs>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Próximamente
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[{ icon: Youtube, label: 'Conectar YouTube' }].map((item) => (
            <Card key={item.label} className="opacity-60">
              <CardContent className="flex items-center gap-3 p-4">
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <Badge variant="outline" className="ml-auto">
                  Próximamente
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
