'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SeoPanel, type SeoPanelData } from './seo-panel';
import { WarningsPanel, type WarningItem } from './warnings-panel';
import { HistoryPanel } from './history-panel';
import { ProjectInfoPanel } from './project-info-panel';
import type { DocumentVersionItem } from '@/lib/data/versions';
import type { Database } from '@/lib/types/database';

type ProjectRow = Database['public']['Tables']['projects']['Row'];

export function EditorDrawerTabs({
  documentId,
  projectId,
  project,
  documentTitle,
  excerpt,
  seo,
  wordCount,
  html,
  warnings,
  sourceLinksByBlock,
  onNavigateToSegment,
  versions,
  currentUserId,
}: {
  documentId: string;
  projectId: string;
  project: ProjectRow;
  documentTitle: string;
  excerpt: string;
  seo: SeoPanelData;
  wordCount: number;
  html: string;
  warnings: WarningItem[];
  sourceLinksByBlock: Map<string, string[]>;
  onNavigateToSegment: (segmentId: string) => void;
  versions: DocumentVersionItem[];
  currentUserId: string | null;
}) {
  return (
    <Tabs defaultValue="seo" className="flex h-full flex-col">
      <TabsList className="mx-4 mt-3 grid grid-cols-4">
        <TabsTrigger value="seo">SEO</TabsTrigger>
        <TabsTrigger value="alerts">
          Alertas
          {warnings.filter((w) => w.status === 'open').length > 0 && (
            <span className="ml-1 rounded-full bg-warning px-1.5 text-[10px] text-warning-foreground">
              {warnings.filter((w) => w.status === 'open').length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="history">Historial</TabsTrigger>
        <TabsTrigger value="project">Proyecto</TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-y-auto">
        <TabsContent value="seo" className="mt-0">
          <SeoPanel
            documentId={documentId}
            documentTitle={documentTitle}
            initialExcerpt={excerpt}
            initialSeo={seo}
            wordCount={wordCount}
            html={html}
          />
        </TabsContent>
        <TabsContent value="alerts" className="mt-0">
          <WarningsPanel
            warnings={warnings}
            sourceLinksByBlock={sourceLinksByBlock}
            onNavigateToSegment={onNavigateToSegment}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-0">
          <HistoryPanel
            documentId={documentId}
            projectId={projectId}
            currentTitle={documentTitle}
            currentHtml={html}
            versions={versions}
            currentUserId={currentUserId}
          />
        </TabsContent>
        <TabsContent value="project" className="mt-0">
          <ProjectInfoPanel project={project} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
