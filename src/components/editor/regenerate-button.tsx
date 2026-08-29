'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2, Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { generateArticleAction } from '@/lib/actions/generation';
import { updateProjectAction } from '@/lib/actions/projects';
import { READING_TIME_OPTIONS } from '@/lib/validations/project';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

/**
 * Regenerar el artículo desde la transcripción, opcionalmente cambiando el
 * tiempo de lectura objetivo (que controla la extensión). Acción SECUNDARIA:
 * reemplaza el contenido del editor; la versión actual queda en el historial
 * vía el pipeline de generación.
 */
export function RegenerateButton({
  projectId,
  currentTargetReadingMinutes,
  className,
}: {
  projectId: string;
  currentTargetReadingMinutes: number | null;
  className?: string;
}) {
  const router = useRouter();
  const t = useDictionary();
  const [isRegenerating, setIsRegenerating] = useState(false);

  async function regenerate(targetReadingMinutes: number | null) {
    if (!window.confirm(t.editor.actions.regenerateConfirm)) return;
    setIsRegenerating(true);
    try {
      if (targetReadingMinutes !== currentTargetReadingMinutes) {
        const updated = await updateProjectAction(projectId, { targetReadingMinutes });
        if (!updated.success) {
          toast.error(updated.error.message);
          return;
        }
      }
      const result = await generateArticleAction(projectId);
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t.editor.actions.regenerateSuccess);
      router.refresh();
    } finally {
      setIsRegenerating(false);
    }
  }

  const options: Array<{ value: number | null; label: string }> = [
    { value: null, label: t.projects.new.readingTimeAuto },
    ...READING_TIME_OPTIONS.map((min) => ({
      value: min,
      label: t.projects.new.readingTimeMinutes.replace('{n}', String(min)),
    })),
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={className} disabled={isRegenerating}>
          {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="hidden sm:inline">
            {isRegenerating ? t.editor.actions.regenerating : t.editor.actions.regenerate}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{t.editor.actions.regenerateLengthLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value ?? 'auto'}
            onClick={() => regenerate(option.value)}
            disabled={isRegenerating}
          >
            <Check
              className={cn('h-4 w-4', option.value === currentTargetReadingMinutes ? 'opacity-100' : 'opacity-0')}
            />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
