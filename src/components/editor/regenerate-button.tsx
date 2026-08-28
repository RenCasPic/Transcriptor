'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { generateArticleAction } from '@/lib/actions/generation';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

/**
 * Regenerar el artículo desde la transcripción. Acción SECUNDARIA (puede
 * reemplazar el contenido editado; la versión actual queda en el historial vía
 * el pipeline de generación). Reutiliza `generateArticleAction` sin cambios.
 */
export function RegenerateButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const t = useDictionary();
  const [isRegenerating, setIsRegenerating] = useState(false);

  async function handleRegenerate() {
    if (!window.confirm(t.editor.actions.regenerateConfirm)) return;
    setIsRegenerating(true);
    const result = await generateArticleAction(projectId);
    setIsRegenerating(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success(t.editor.actions.regenerateSuccess);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleRegenerate} disabled={isRegenerating}>
      {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      <span className="hidden sm:inline">
        {isRegenerating ? t.editor.actions.regenerating : t.editor.actions.regenerate}
      </span>
    </Button>
  );
}
