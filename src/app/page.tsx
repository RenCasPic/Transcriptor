import Link from 'next/link';
import {
  ArrowRight,
  FileText,
  Mic,
  Sparkles,
  ShieldCheck,
  History,
  SearchCheck,
  Quote,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const STEPS = [
  {
    icon: Mic,
    title: '1. Añade tu contenido',
    description:
      'Pega una transcripción, sube un archivo TXT, SRT o VTT, o utiliza una transcripción de demostración para explorar la app.',
  },
  {
    icon: Sparkles,
    title: '2. Generación automática',
    description:
      'La IA reorganiza la transcripción en un artículo con título, estructura de encabezados, conclusión, preguntas frecuentes y SEO.',
  },
  {
    icon: FileText,
    title: '3. Edita con precisión',
    description:
      'Ajusta el resultado en un editor enriquecido, selecciona texto y pide reescribir, acortar, expandir o mejorar para SEO.',
  },
  {
    icon: ShieldCheck,
    title: '4. Verifica y publica',
    description:
      'Revisa alertas de cifras, nombres y fechas, relaciona cada sección con su fuente y exporta cuando esté listo.',
  },
];

const BENEFITS = [
  {
    icon: Quote,
    title: 'Fiel a la fuente',
    description:
      'El artículo se construye a partir de tu transcripción: no se inventan cifras, nombres, fechas ni testimonios.',
  },
  {
    icon: SearchCheck,
    title: 'Cada afirmación es rastreable',
    description:
      'Cada bloque del artículo puede vincularse al segmento exacto de la transcripción que lo respalda.',
  },
  {
    icon: History,
    title: 'Historial de versiones',
    description:
      'Cada generación, reescritura o restauración queda registrada para que nunca pierdas una versión anterior.',
  },
  {
    icon: ListChecks,
    title: 'SEO desde el primer borrador',
    description:
      'Título, slug, meta description y checklist SEO se generan junto al artículo, no como un paso aparte.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            Transcriptor
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild>
              <Link href="/register">
                Crear cuenta gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container flex flex-col items-center gap-6 py-20 text-center md:py-28">
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="h-3 w-3" />
            De video a artículo, sin perder fidelidad
          </Badge>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Convierte contenido audiovisual en artículos{' '}
            <span className="text-primary">editables, verificables</span> y listos para publicar
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Pega la transcripción de tu video o podcast, configura audiencia y tono, y obtén un
            borrador de blog estructurado que puedes editar, verificar contra la fuente original y
            exportar en minutos.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">
                Empezar gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Ya tengo cuenta</Link>
            </Button>
          </div>
        </section>

        <section className="border-y bg-muted/40 py-20">
          <div className="container">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Cómo funciona</h2>
              <p className="mt-3 text-muted-foreground">
                Un flujo pensado para llevar tu contenido audiovisual a un artículo publicable sin
                perder el control editorial.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <Card key={step.title}>
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{step.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Por qué Transcriptor</h2>
              <p className="mt-3 text-muted-foreground">
                Generar contenido automáticamente no debería significar perder el control sobre lo
                que se publica.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {BENEFITS.map((benefit) => (
                <div key={benefit.title} className="flex gap-4 rounded-xl border p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <benefit.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{benefit.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-primary text-primary-foreground">
          <div className="container flex flex-col items-center gap-6 py-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Convierte tu próxima transcripción en un artículo hoy
            </h2>
            <p className="max-w-xl text-primary-foreground/80">
              Crea tu cuenta, pega una transcripción y prueba el modo demo sin necesidad de
              configurar ninguna clave de IA.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/register">
                Crear cuenta gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Transcriptor. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Iniciar sesión
            </Link>
            <Link href="/register" className="hover:text-foreground">
              Registrarse
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
