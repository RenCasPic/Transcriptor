import { FolderKanban, FileText, Sparkles, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ProjectListItem } from '@/lib/data/projects';

export function DashboardStats({ projects }: { projects: ProjectListItem[] }) {
  const totalProjects = projects.length;
  const totalWords = projects.reduce((sum, p) => sum + p.wordCount, 0);
  const inProgress = projects.filter((p) => p.status === 'review' || p.status === 'processing').length;
  const published = projects.filter((p) => p.status === 'published').length;

  const stats = [
    {
      icon: FolderKanban,
      label: 'Proyectos',
      value: totalProjects.toLocaleString('es'),
      color: 'bg-indigo-500/10 text-indigo-600',
    },
    {
      icon: FileText,
      label: 'Palabras generadas',
      value: totalWords.toLocaleString('es'),
      color: 'bg-violet-500/10 text-violet-600',
    },
    {
      icon: Sparkles,
      label: 'En proceso',
      value: inProgress.toLocaleString('es'),
      color: 'bg-amber-500/10 text-amber-600',
    },
    {
      icon: CheckCircle2,
      label: 'Publicados',
      value: published.toLocaleString('es'),
      color: 'bg-emerald-500/10 text-emerald-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-semibold leading-none">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
