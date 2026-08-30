import type { Metadata, Viewport } from 'next';
import { Fraunces, Space_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { DictionaryProvider } from '@/lib/i18n/dictionary-provider';
import './globals.css';

// Fraunces: serif "old-style" contemporáneo, con carácter editorial (para
// títulos display y el cuerpo del artículo). Space Mono: monoespaciada con
// personalidad, para etiquetas, metadatos y los folios de la sala de edición.
const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});
const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-space-mono',
  display: 'swap',
});

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
    <html lang={locale} className={`h-full ${fraunces.variable} ${spaceMono.variable}`}>
      <body className="h-full antialiased">
        <DictionaryProvider locale={locale} dictionary={dictionary}>
          {children}
          <Toaster />
        </DictionaryProvider>
      </body>
    </html>
  );
}
