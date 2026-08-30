import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/sonner';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { DictionaryProvider } from '@/lib/i18n/dictionary-provider';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getDictionary();
  const titleDefault =
    locale === 'en' ? 'TalkToPost — From video to article' : 'TalkToPost — De video a artículo';
  const description =
    locale === 'en'
      ? 'Turn video and audio transcripts into editable, verifiable, publish-ready blog articles.'
      : 'Convierte transcripciones de video y audio en artículos de blog editables, verificables y listos para publicar.';

  return {
    title: {
      default: titleDefault,
      template: '%s · TalkToPost',
    },
    description,
    manifest: '/manifest.webmanifest',
  };
}

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dictionary } = await getDictionary();

  return (
    <html lang={locale} className="h-full">
      <body className="h-full antialiased">
        <DictionaryProvider locale={locale} dictionary={dictionary}>
          {children}
          <Toaster />
        </DictionaryProvider>
      </body>
    </html>
  );
}
