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
import { FadeIn } from '@/components/landing/fade-in';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export default async function LandingPage() {
  const { dictionary: t } = await getDictionary();

  const STEPS = [
    { icon: Mic, title: t.landing.steps.step1Title, description: t.landing.steps.step1Description, color: 'bg-indigo-500/10 text-indigo-600' },
    { icon: Sparkles, title: t.landing.steps.step2Title, description: t.landing.steps.step2Description, color: 'bg-violet-500/10 text-violet-600' },
    { icon: FileText, title: t.landing.steps.step3Title, description: t.landing.steps.step3Description, color: 'bg-amber-500/10 text-amber-600' },
    { icon: ShieldCheck, title: t.landing.steps.step4Title, description: t.landing.steps.step4Description, color: 'bg-emerald-500/10 text-emerald-600' },
  ];

  const BENEFITS = [
    { icon: Quote, title: t.landing.benefits.benefit1Title, description: t.landing.benefits.benefit1Description, color: 'bg-rose-500/10 text-rose-600' },
    { icon: SearchCheck, title: t.landing.benefits.benefit2Title, description: t.landing.benefits.benefit2Description, color: 'bg-sky-500/10 text-sky-600' },
    { icon: History, title: t.landing.benefits.benefit3Title, description: t.landing.benefits.benefit3Description, color: 'bg-emerald-500/10 text-emerald-600' },
    { icon: ListChecks, title: t.landing.benefits.benefit4Title, description: t.landing.benefits.benefit4Description, color: 'bg-violet-500/10 text-violet-600' },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            {t.common.appName}
          </Link>
          <nav className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" asChild>
              <Link href="/login">{t.landing.signIn}</Link>
            </Button>
            <Button asChild>
              <Link href="/register">
                {t.landing.createFreeAccount}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden py-20 md:py-28">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-[-10rem] -z-10 flex justify-center blur-3xl"
          >
            <div className="animate-blob h-[36rem] w-[64rem] rounded-full bg-gradient-to-tr from-indigo-400/70 via-violet-400/60 to-amber-300/60" />
          </div>
          <FadeIn className="container flex flex-col items-center gap-6 text-center">
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="h-3 w-3 animate-pulse" />
              {t.landing.heroBadge}
            </Badge>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
              {t.landing.heroTitle} <span className="text-primary">{t.landing.heroTitleHighlight}</span>
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">{t.landing.heroSubtitle}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/register" className="group">
                  {t.landing.startFree}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">{t.landing.alreadyHaveAccount}</Link>
              </Button>
            </div>
          </FadeIn>
        </section>

        <section className="border-y bg-muted/40 py-20">
          <div className="container">
            <FadeIn className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">{t.landing.howItWorksTitle}</h2>
              <p className="mt-3 text-muted-foreground">{t.landing.howItWorksSubtitle}</p>
            </FadeIn>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <FadeIn key={step.title} delayMs={index * 100}>
                  <Card className="h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <CardHeader>
                      <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${step.color}`}>
                        <step.icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-base">{step.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{step.description}</CardDescription>
                    </CardContent>
                  </Card>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container">
            <FadeIn className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">{t.landing.benefitsTitle}</h2>
              <p className="mt-3 text-muted-foreground">{t.landing.benefitsSubtitle}</p>
            </FadeIn>
            <div className="grid gap-6 sm:auto-rows-fr sm:grid-cols-2">
              {BENEFITS.map((benefit, index) => (
                <FadeIn key={benefit.title} delayMs={index * 100}>
                  <div className="flex h-full gap-4 rounded-xl border border-primary bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${benefit.color}`}>
                      <benefit.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{benefit.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-primary text-primary-foreground">
          <FadeIn className="container flex flex-col items-center gap-6 py-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight">{t.landing.ctaTitle}</h2>
            <p className="max-w-xl text-primary-foreground/80">{t.landing.ctaSubtitle}</p>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/register" className="group">
                {t.landing.createFreeAccount}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </FadeIn>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {t.common.appName}. {t.landing.footerRights}
          </p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              {t.landing.signIn}
            </Link>
            <Link href="/register" className="hover:text-foreground">
              {t.auth.register.submit}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
