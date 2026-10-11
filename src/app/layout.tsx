import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { DictionaryProvider } from '@/lib/i18n/dictionary-provider';
import { THEME_INIT_SCRIPT } from '@/lib/theme/theme';
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
  // Color de la barra del navegador en móvil: índigo en claro, fondo índigo
  // oscuro en oscuro (sigue la preferencia del sistema).
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#4f46e5' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0e1a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dictionary } = await getDictionary();

  return (
    // suppressHydrationWarning: el script del <head> añade la clase "dark" a
    // <html> antes de que React hidrate, así que el atributo difiere del servidor.
    <html lang={locale} className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-full antialiased">
        <ThemeProvider>
          <DictionaryProvider locale={locale} dictionary={dictionary}>
            {children}
            <Toaster />
          </DictionaryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
