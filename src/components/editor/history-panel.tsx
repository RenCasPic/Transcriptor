'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { History, Eye, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/content/format';
import { formatVersionReason } from '@/lib/content/version-reason';
import { restoreVersionAction } from '@/lib/actions/versions';
import type { DocumentVersionItem } from '@/lib/data/versions';
import { VersionCompareDialog } from './version-compare-dialog';
import { CreateVersionDialog } from './create-version-dialog';
import { useDictionary, useLocale } from '@/lib/i18n/dictionary-provider';

export function HistoryPanel({
  documentId,
  projectId,
  currentTitle,
  currentHtml,
  versions,
  currentUserId,
}: {
  documentId: string;
  projectId: string;
  currentTitle: string;
  currentHtml: string;
  versions: DocumentVersionItem[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const t = useDictionary();
  const locale = useLocale();
  const [compareVersion, setCompareVersion] = useState<DocumentVersionItem | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function handleRestore(version: DocumentVersionItem) {
    const confirmed = window.confirm(
      `${t.editor.history.restoreConfirm} ${version.versionNumber}${t.editor.history.restoreConfirmSuffix}`,
    );
    if (!confirmed) return;

    setRestoringId(version.id);
    const result = await restoreVersionAction({ documentId, versionId: version.id, projectId });
    setRestoringId(null);

    if (!result.success) {
      toast.error(result.error.message);
      return;
    }

    toast.success(t.editor.history.restoreSuccess);
    router.refresh();
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <History className="h-4 w-4" />
          {t.editor.history.title}
        </h3>
      </div>

      <CreateVersionDialog documentId={documentId} />

      <div className="space-y-2">
        {versions.map((version) => (
          <div key={version.id} className="space-y-1.5 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {t.editor.history.version} {version.versionNumber}
              </span>
              <span className="text-xs text-muted-foreground">{formatDate(version.createdAt)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{formatVersionReason(version.reason, locale)}</p>
            <p className="text-xs text-muted-foreground">
              {t.editor.history.author}:{' '}
              {version.createdBy === currentUserId
                ? t.editor.history.you
                : version.createdBy
                  ? t.editor.history.collaborator
                  : t.editor.history.system}
            </p>
            <div className="flex gap-1.5 pt-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCompareVersion(version)}>
                <Eye className="h-3 w-3" />
                {t.editor.history.view}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                disabled={restoringId === version.id}
                onClick={() => handleRestore(version)}
              >
                <RotateCcw className="h-3 w-3" />
                {t.editor.history.restore}
              </Button>
            </div>
          </div>
        ))}
        {versions.length === 0 && <p className="text-xs text-muted-foreground">{t.editor.history.empty}</p>}
      </div>

      {compareVersion && (
        <VersionCompareDialog
          open={!!compareVersion}
          onOpenChange={(open) => !open && setCompareVersion(null)}
          currentHtml={currentHtml}
          currentTitle={currentTitle}
          versionHtml={compareVersion.contentHtml}
          versionTitle={compareVersion.title}
          versionNumber={compareVersion.versionNumber}
        />
      )}
    </div>
  );
}
