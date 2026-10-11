import { ChevronDown } from 'lucide-react';
import { getDictionary } from '@/lib/i18n/get-dictionary';

/** Preguntas frecuentes de precios. `<details>` nativo: accesible y sin JavaScript. */
export async function PricingFaq() {
  const { dictionary: t } = await getDictionary();

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-center text-3xl font-bold tracking-tight">{t.pricing.faqTitle}</h2>
      <div className="mt-8 space-y-3">
        {t.pricing.faq.map((item) => (
          <details
            key={item.question}
            className="group rounded-xl border border-primary bg-card px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {item.question}
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
