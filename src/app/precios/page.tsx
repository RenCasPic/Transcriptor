import type { Metadata } from 'next';
import { SiteHeader } from '@/components/landing/site-header';
import { SiteFooter } from '@/components/landing/site-footer';
import { PricingPlans } from '@/components/pricing/pricing-plans';
import { PricingFaq } from '@/components/pricing/pricing-faq';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary: t } = await getDictionary();
  return { title: t.pricing.metaTitle, description: t.pricing.metaDescription };
}

export default async function PricingPage() {
  const { dictionary: t } = await getDictionary();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="container py-16 md:py-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{t.pricing.title}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{t.pricing.subtitle}</p>
          </div>
          <PricingPlans />
        </section>

        <section className="border-t bg-muted/40 py-16 md:py-20">
          <div className="container">
            <PricingFaq />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
