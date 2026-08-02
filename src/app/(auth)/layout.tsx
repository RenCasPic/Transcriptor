import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/30 px-4 py-12">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        TalkToPost
      </Link>
      <div className="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm">{children}</div>
    </div>
  );
}
