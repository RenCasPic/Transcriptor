import type { Dictionary } from '@/lib/i18n/dictionaries';

/**
 * Planes de suscripción — ÚNICO lugar donde viven precios, límites y qué
 * incluye cada plan. Por ahora solo se MUESTRAN (no hay cobro ni límites
 * aplicados): para cambiar un precio o un límite basta editar este archivo.
 * Los textos viven en los diccionarios (`pricing.*`); aquí solo hay datos.
 */

export type PlanId = 'free' | 'creator' | 'pro';
export type BillingPeriod = 'monthly' | 'annual';

/** Moneda de todos los precios de esta página. */
export const PRICING_CURRENCY = 'USD';
export const PRICING_CURRENCY_SYMBOL = '$';

/** Descuento que se anuncia en el selector Mensual/Anual ("Ahorra 25%"). */
export const ANNUAL_DISCOUNT_PERCENT = 25;

/** Características de texto fijo; su etiqueta está en `dictionary.pricing.features`. */
export type PricingFeatureKey =
  | 'aiEditor'
  | 'exportFormats'
  | 'youtubeImport'
  | 'aiRewriteTitle'
  | 'versionHistory'
  | 'embedCode'
  | 'priorityProcessing'
  | 'prioritySupport'
  | 'publishCms'
  | 'teamInvite';

export type PlanFeature =
  | { kind: 'articlesPerMonth'; value: number }
  /** Duración máxima de un archivo, en minutos (se muestra en h si es múltiplo de 60). */
  | { kind: 'maxFileMinutes'; value: number }
  | { kind: 'key'; key: PricingFeatureKey };

export interface Plan {
  id: PlanId;
  /** USD/mes pagando mes a mes. */
  monthlyPrice: number;
  /** USD/mes equivalente pagando el año completo. */
  annualMonthlyPrice: number;
  /** El plan destacado ("Más popular"). */
  featured: boolean;
  features: PlanFeature[];
  /** Funciones anunciadas pero todavía no disponibles. */
  comingSoon: PricingFeatureKey[];
}

export const PLANS: readonly Plan[] = [
  {
    id: 'free',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    featured: false,
    features: [
      { kind: 'articlesPerMonth', value: 3 },
      { kind: 'maxFileMinutes', value: 20 },
      { kind: 'key', key: 'aiEditor' },
      { kind: 'key', key: 'exportFormats' },
    ],
    comingSoon: [],
  },
  {
    id: 'creator',
    monthlyPrice: 12,
    annualMonthlyPrice: 9,
    featured: true,
    features: [
      { kind: 'articlesPerMonth', value: 30 },
      { kind: 'maxFileMinutes', value: 120 },
      { kind: 'key', key: 'youtubeImport' },
      { kind: 'key', key: 'aiRewriteTitle' },
      { kind: 'key', key: 'versionHistory' },
      { kind: 'key', key: 'embedCode' },
    ],
    comingSoon: [],
  },
  {
    id: 'pro',
    monthlyPrice: 29,
    annualMonthlyPrice: 23,
    featured: false,
    features: [
      { kind: 'articlesPerMonth', value: 100 },
      { kind: 'maxFileMinutes', value: 240 },
      { kind: 'key', key: 'priorityProcessing' },
      { kind: 'key', key: 'prioritySupport' },
    ],
    comingSoon: ['publishCms', 'teamInvite'],
  },
];

/** Precio mensual que se muestra según el periodo elegido. */
export function planMonthlyPrice(plan: Plan, billing: BillingPeriod): number {
  return billing === 'annual' ? plan.annualMonthlyPrice : plan.monthlyPrice;
}

/** Total anual que se factura en el periodo "Anual" (0 para el plan gratuito). */
export function planAnnualTotal(plan: Plan): number {
  return plan.annualMonthlyPrice * 12;
}

export function formatPrice(amount: number): string {
  return `${PRICING_CURRENCY_SYMBOL}${amount}`;
}

type PricingFeatureLabels = Dictionary['pricing']['features'];

/** Texto de una característica en el idioma del diccionario recibido. */
export function describePlanFeature(feature: PlanFeature, labels: PricingFeatureLabels): string {
  switch (feature.kind) {
    case 'articlesPerMonth':
      return labels.articlesPerMonth.replace('{n}', String(feature.value));
    case 'maxFileMinutes':
      return feature.value >= 60 && feature.value % 60 === 0
        ? labels.fileUpToHours.replace('{n}', String(feature.value / 60))
        : labels.fileUpToMinutes.replace('{n}', String(feature.value));
    case 'key':
      return labels[feature.key];
  }
}
