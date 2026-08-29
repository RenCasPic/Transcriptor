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
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import type { Json } from '@/lib/types/database';

export function ExportMenu({
  title,
  html,
  json,
  className,
}: {
  title: string;
  html: string;
  json: Json;
  className?: string;
}) {
  const t = useDictionary();
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
      toast.success(t.editor.export.copySuccess);
    } catch {
      toast.error(t.editor.export.copyError);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Download className="h-4 w-4" />
          {t.editor.export.button}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleExportMarkdown}>{t.editor.export.markdown}</DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportHtml}>{t.editor.export.html}</DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPlainText}>{t.editor.export.plainText}</DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy}>
          <Copy className="h-4 w-4" />
          {t.editor.export.copyToClipboard}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t.editor.export.publishComingSoon}
        </DropdownMenuLabel>
        <DropdownMenuItem disabled className="justify-between">
          WordPress
          <Badge variant="outline">{t.editor.export.comingSoon}</Badge>
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="justify-between">
          Webflow
          <Badge variant="outline">{t.editor.export.comingSoon}</Badge>
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="justify-between">
          Ghost
          <Badge variant="outline">{t.editor.export.comingSoon}</Badge>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
