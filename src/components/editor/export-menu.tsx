'use client';

import { Download, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { proseMirrorJsonToMarkdown, proseMirrorJsonToPlainText } from '@/lib/content/article-transform';
import { downloadTextFile } from '@/lib/content/download';
import { slugify } from '@/lib/content/slug';
import type { Json } from '@/lib/types/database';

export function ExportMenu({ title, html, json }: { title: string; html: string; json: Json }) {
  const filenameBase = slugify(title) || 'articulo';

  function handleExportMarkdown() {
    downloadTextFile(`${filenameBase}.md`, proseMirrorJsonToMarkdown(json), 'text/markdown;charset=utf-8');
  }

  function handleExportHtml() {
    downloadTextFile(`${filenameBase}.html`, html, 'text/html;charset=utf-8');
  }

  function handleExportPlainText() {
    downloadTextFile(`${filenameBase}.txt`, proseMirrorJsonToPlainText(json), 'text/plain;charset=utf-8');
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(proseMirrorJsonToPlainText(json));
      toast.success('Artículo copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar el artículo');
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleExportMarkdown}>Markdown (.md)</DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportHtml}>HTML (.html)</DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPlainText}>Texto plano (.txt)</DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy}>
          <Copy className="h-4 w-4" />
          Copiar al portapapeles
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Publicar (próximamente)</DropdownMenuLabel>
        <DropdownMenuItem disabled className="justify-between">
          WordPress
          <Badge variant="outline">Próximamente</Badge>
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="justify-between">
          Webflow
          <Badge variant="outline">Próximamente</Badge>
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="justify-between">
          Ghost
          <Badge variant="outline">Próximamente</Badge>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
