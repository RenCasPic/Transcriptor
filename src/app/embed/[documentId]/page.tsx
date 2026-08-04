import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { getPublicDocument } from '@/lib/data/embed';
import { getDictionary } from '@/lib/i18n/get-dictionary';

interface EmbedPageProps {
  params: Promise<{ documentId: string }>;
}

export async function generateMetadata({ params }: EmbedPageProps): Promise<Metadata> {
  const { documentId } = await params;
  const document = await getPublicDocument(documentId);
  if (!document) return { title: 'TalkToPost' };

  return {
    title: document.seoTitle || document.title,
    description: document.metaDescription || document.excerpt || undefined,
    robots: { index: true, follow: true },
  };
}

export default async function EmbedPage({ params }: EmbedPageProps) {
  const { documentId } = await params;
  const document = await getPublicDocument(documentId);
  const { dictionary: t } = await getDictionary();

  if (!document) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold">{t.embed.notFoundTitle}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.embed.notFoundDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <article className="mx-auto max-w-2xl px-6 py-10">
        {document.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={document.coverImageUrl}
            alt={document.coverImageAlt ?? document.title}
            className="mb-8 aspect-video w-full rounded-xl object-cover"
          />
        )}
        <h1 className="text-3xl font-bold tracking-tight">{document.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {document.readingTimeMinutes} {t.common.minutesReading} · {document.wordCount.toLocaleString()}{' '}
          {t.common.words}
        </p>
        {document.excerpt && <p className="mt-3 text-lg text-muted-foreground">{document.excerpt}</p>}
        <div
          className="prose prose-neutral mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: document.contentHtml }}
        />
      </article>
      <footer className="border-t py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-1.5 px-6 text-xs text-muted-foreground">
          {t.embed.poweredBy}
          <Link href="/" target="_blank" className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
            <Sparkles className="h-3 w-3" />
            TalkToPost
          </Link>
        </div>
      </footer>
    </div>
  );
}
