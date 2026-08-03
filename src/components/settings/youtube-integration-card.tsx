'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Youtube, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { disconnectIntegrationAction } from '@/lib/actions/integrations';
import { useDictionary } from '@/lib/i18n/dictionary-provider';

export function YoutubeIntegrationCard({
  workspaceId,
  status,
  channelTitle,
  canManage,
}: {
  workspaceId: string;
  status: 'disconnected' | 'connected' | 'error';
  channelTitle: string | null;
  canManage: boolean;
}) {
  const t = useDictionary();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const hasHandledParam = useRef(false);

  useEffect(() => {
    if (hasHandledParam.current) return;
    const youtubeParam = searchParams.get('youtube');
    if (youtubeParam === 'connected') {
      hasHandledParam.current = true;
      toast.success(t.settings.integrations.connectSuccess);
      router.replace('/settings/integrations');
    } else if (youtubeParam === 'error') {
      hasHandledParam.current = true;
      toast.error(t.settings.integrations.connectError);
      router.replace('/settings/integrations');
    }
  }, [searchParams, router, t]);

  async function handleDisconnect() {
    setIsDisconnecting(true);
    const result = await disconnectIntegrationAction({ workspaceId, provider: 'youtube' });
    setIsDisconnecting(false);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success(t.settings.integrations.disconnectSuccess);
    router.refresh();
  }

  const isConnected = status === 'connected';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <Youtube className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <CardTitle className="text-base">{t.settings.integrations.youtubeTitle}</CardTitle>
          <CardDescription>{t.settings.integrations.youtubeDescription}</CardDescription>
        </div>
        <Badge variant={isConnected ? 'default' : 'outline'}>
          {isConnected ? channelTitle ?? t.settings.integrations.connectedAs : t.settings.integrations.notConnected}
        </Badge>
      </CardHeader>
      <CardContent>
        {!canManage ? (
          <p className="text-sm text-muted-foreground">{t.settings.integrations.onlyOwnerAdmin}</p>
        ) : isConnected ? (
          <Button variant="outline" onClick={handleDisconnect} disabled={isDisconnecting}>
            {isDisconnecting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t.settings.integrations.disconnect}
          </Button>
        ) : (
          <Button asChild>
            <a href="/api/integrations/youtube/connect">{t.settings.integrations.connect}</a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
