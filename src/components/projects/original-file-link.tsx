'use client';

import { useState } from 'react';
import { Loader2, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getMediaSourceSignedUrlAction } from '@/lib/actions/storage';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export function OriginalFileLink({ mediaSourceId }: { mediaSourceId: string }) {
  const t = useDictionary();
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    const result = await getMediaSourceSignedUrlAction({ mediaSourceId });
    setIsLoading(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    window.open(result.data.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClick} disabled={isLoading}>
      {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
      {t.projects.detail.viewOriginalFile}
    </Button>
  );
}
