import { redirect } from 'next/navigation';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Header } from '@/components/layout/header';
import { getCurrentWorkspace, getCurrentUserProfile } from '@/lib/data/workspace';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [workspace, profile] = await Promise.all([getCurrentWorkspace(), getCurrentUserProfile()]);

  if (!workspace || !profile) {
    redirect('/login');
  }

  const userName = profile.full_name || profile.email || 'Usuario';

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r lg:block">
        <SidebarNav workspaceName={workspace.name} />
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <Header workspaceName={workspace.name} userName={userName} />
        <main className="flex-1 bg-gradient-to-br from-indigo-50/50 via-background to-violet-50/40 p-4 dark:from-indigo-950/10 dark:to-violet-950/10 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
