'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useDictionary } from '@/lib/i18n/dictionary-provider';
import {
  ANNUAL_DISCOUNT_PERCENT,
  PLANS,
  describePlanFeature,
  formatPrice,
  planAnnualTotal,
  planMonthlyPrice,
  type BillingPeriod,
} from '@/lib/pricing/plans';

/**
 * Selector Mensual/Anual + las tarjetas de los planes + la nota honesta de que
 * todavía no hay cobro. Se usa en la landing y en /precios. Los datos salen de
 * `lib/pricing/plans.ts` y los textos de `dictionary.pricing`.
 */
export function PricingPlans() {
  const t = useDictionary();
  const [billing, setBilling] = useState<BillingPeriod>('monthly');

  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div
          role="radiogroup"
          aria-label={t.pricing.billingLabel}
          className="inline-grid grid-cols-2 gap-1 rounded-lg border border-primary/30 bg-muted/60 p-1"
        >
          <BillingOption selected={billing === 'monthly'} onSelect={() => setBilling('monthly')}>
            {t.pricing.monthly}
          </BillingOption>
          <BillingOption selected={billing === 'annual'} onSelect={() => setBilling('annual')}>
            {t.pricing.annual}
            <Badge variant="success" className="whitespace-nowrap px-1.5 py-0 text-[0.65rem]">
              {t.pricing.saveBadge.replace('{n}', String(ANNUAL_DISCOUNT_PERCENT))}
            </Badge>
          </BillingOption>
        </div>
      </div>

      <div className="mx-auto grid max-w-md gap-8 pt-2 lg:max-w-none lg:grid-cols-3 lg:gap-6">
        {PLANS.map((plan) => {
          const copy = t.pricing.plans[plan.id];
          const isFree = plan.monthlyPrice === 0;
          const billingNote = isFree
            ? t.pricing.noCardNeeded
            : billing === 'annual'
              ? t.pricing.billedAnnually.replace('{total}', formatPrice(planAnnualTotal(plan)))
              : t.pricing.billedMonthly;

          return (
            <Card
              key={plan.id}
              className={cn('relative flex flex-col p-6 sm:p-7', plan.featured && 'shadow-lg ring-2 ring-primary')}
            >
              {plan.featured && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  {t.pricing.mostPopular}
                </Badge>
              )}

              <h3 className="text-lg font-semibold">{copy.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{copy.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{formatPrice(planMonthlyPrice(plan, billing))}</span>
                <span className="text-sm text-muted-foreground">{t.pricing.perMonth}</span>
              </div>
              <p className="mt-1 min-h-5 text-xs text-muted-foreground">{billingNote}</p>

              <Button asChild className="mt-5 w-full" variant={plan.featured ? 'default' : 'outline'}>
                <Link href="/register">{copy.cta}</Link>
              </Button>

              <ul className="mt-6 space-y-2.5 text-sm">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>{describePlanFeature(feature, t.pricing.features)}</span>
                  </li>
                ))}
              </ul>

              {plan.comingSoon.length > 0 && (
                <ul className="mt-4 space-y-2.5 border-t pt-4 text-sm text-muted-foreground">
                  {plan.comingSoon.map((key) => (
                    <li key={key} className="flex items-start gap-2">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {t.pricing.features[key]}
                        <Badge variant="outline" className="px-2 py-0 text-[0.65rem]">
                          {t.pricing.comingSoon}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <p className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">{t.pricing.note}</p>
    </div>
  );
}

function BillingOption({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors',
        selected ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
