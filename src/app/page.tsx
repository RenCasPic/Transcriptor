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
    title: '1. Sube tu transcripción',
    description: 'Pega el texto, sube un archivo TXT, SRT o VTT, o prueba con un ejemplo ya listo.',
  },
  {
    icon: Sparkles,
    title: '2. La IA arma tu artículo',
    description: 'En segundos tienes un artículo con título, secciones y preguntas frecuentes.',
  },
  {
    icon: FileText,
    title: '3. Edítalo a tu gusto',
    description: 'Cambia lo que quieras, ajusta el tono o pídele a la IA que reescriba una parte.',
  },
  {
    icon: ShieldCheck,
    title: '4. Revisa y publícalo',
    description: 'Verifica que todo esté correcto y exporta tu artículo en el formato que necesites.',
  },
];

const BENEFITS = [
  {
    icon: Quote,
    title: 'Fiel a lo que dijiste',
    description: 'El artículo se arma con tu contenido real, sin inventar cifras, nombres ni datos.',
  },
  {
    icon: SearchCheck,
    title: 'Todo tiene su fuente',
    description: 'Puedes rastrear cualquier parte del artículo hasta el fragmento original.',
  },
  {
    icon: History,
    title: 'Nunca pierdes nada',
    description: 'Guardamos cada versión para que puedas volver atrás cuando quieras.',
  },
  {
    icon: ListChecks,
    title: 'Listo para buscadores',
    description: 'Título, resumen y palabras clave se generan junto con tu artículo.',
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
            TalkToPost
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
            Listo en minutos, sin complicaciones
          </Badge>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Convierte tus videos y podcasts en <span className="text-primary">artículos</span>
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Transforma una transcripción en un artículo bien organizado en pocos minutos. Edita el
            resultado, ajusta el tono y publícalo cuando esté listo.
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
              <p className="mt-3 text-muted-foreground">Del video a la página web, en cuatro pasos.</p>
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
              <h2 className="text-3xl font-bold tracking-tight">Por qué TalkToPost</h2>
              <p className="mt-3 text-muted-foreground">
                Rápido no tiene por qué significar perder el control de lo que publicas.
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
            <h2 className="text-3xl font-bold tracking-tight">Prueba tu primer artículo hoy</h2>
            <p className="max-w-xl text-primary-foreground/80">
              Crea tu cuenta y pruébalo gratis con un ejemplo, sin configurar nada.
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
          <p>© {new Date().getFullYear()} TalkToPost. Todos los derechos reservados.</p>
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
