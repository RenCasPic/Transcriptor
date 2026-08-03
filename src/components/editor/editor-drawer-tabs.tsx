'use client';

import { useState } from 'react';
import { Search, AlertTriangle, History as HistoryIcon, Settings, PanelRightClose } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SeoPanel, type SeoPanelData } from './seo-panel';
import { WarningsPanel, type WarningItem } from './warnings-panel';
import { HistoryPanel } from './history-panel';
import { ProjectInfoPanel } from './project-info-panel';
import type { DocumentVersionItem } from '@/lib/data/versions';
import type { Database } from '@/lib/types/database';

type ProjectRow = Database['public']['Tables']['projects']['Row'];
type DrawerTab = 'seo' | 'alerts' | 'history' | 'project';

const RAIL_ITEMS: Array<{ value: DrawerTab; label: string; icon: typeof Search }> = [
  { value: 'seo', label: 'SEO', icon: Search },
  { value: 'alerts', label: 'Alertas', icon: AlertTriangle },
  { value: 'history', label: 'Historial', icon: HistoryIcon },
  { value: 'project', label: 'Proyecto', icon: Settings },
];

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
  collapsed,
  onToggleCollapsed,
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
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('seo');
  const openWarningsCount = warnings.filter((w) => w.status === 'open').length;

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex h-full flex-col items-center gap-1 py-3">
          {RAIL_ITEMS.map((item) => (
            <Tooltip key={item.value}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9"
                  onClick={() => {
                    setActiveTab(item.value);
                    onToggleCollapsed();
                  }}
                >
                  <item.icon className="h-4 w-4" />
                  {item.value === 'alerts' && openWarningsCount > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-warning text-[9px] text-warning-foreground">
                      {openWarningsCount}
                    </span>
                  )}
                  <span className="sr-only">{item.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DrawerTab)} className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-3">
        <TabsList className="grid flex-1 grid-cols-4">
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="alerts">
            Alertas
            {openWarningsCount > 0 && (
              <span className="ml-1 rounded-full bg-warning px-1.5 text-[10px] text-warning-foreground">
                {openWarningsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="project">Proyecto</TabsTrigger>
        </TabsList>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onToggleCollapsed}>
          <PanelRightClose className="h-4 w-4" />
          <span className="sr-only">Colapsar panel</span>
        </Button>
      </div>
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
