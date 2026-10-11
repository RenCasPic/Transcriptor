import { describe, expect, it } from 'vitest';
import { dictionaries } from '@/lib/i18n/dictionaries';
import {
  PLANS,
  describePlanFeature,
  formatPrice,
  planAnnualTotal,
  planMonthlyPrice,
  type PlanId,
} from '@/lib/pricing/plans';

const plan = (id: PlanId) => PLANS.find((p) => p.id === id)!;

describe('PLANS', () => {
  it('tiene Gratis, Creador y Pro, en ese orden, con un único plan destacado (Creador)', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['free', 'creator', 'pro']);
    expect(PLANS.filter((p) => p.featured).map((p) => p.id)).toEqual(['creator']);
  });

  it('precios en USD: 0 / 12 (9 anual) / 29 (23 anual)', () => {
    expect(planMonthlyPrice(plan('free'), 'monthly')).toBe(0);
    expect(planMonthlyPrice(plan('free'), 'annual')).toBe(0);
    expect(planMonthlyPrice(plan('creator'), 'monthly')).toBe(12);
    expect(planMonthlyPrice(plan('creator'), 'annual')).toBe(9);
    expect(planMonthlyPrice(plan('pro'), 'monthly')).toBe(29);
    expect(planMonthlyPrice(plan('pro'), 'annual')).toBe(23);
  });

  it('el precio anual nunca supera al mensual y el total anual es 12 × el mensual equivalente', () => {
    for (const p of PLANS) {
      expect(p.annualMonthlyPrice).toBeLessThanOrEqual(p.monthlyPrice);
    }
    expect(planAnnualTotal(plan('creator'))).toBe(108);
    expect(planAnnualTotal(plan('pro'))).toBe(276);
    expect(planAnnualTotal(plan('free'))).toBe(0);
  });

  it('solo Pro anuncia funciones "próximamente" (CMS y equipo)', () => {
    expect(plan('free').comingSoon).toEqual([]);
    expect(plan('creator').comingSoon).toEqual([]);
    expect(plan('pro').comingSoon).toEqual(['publishCms', 'teamInvite']);
  });
});

describe('formatPrice', () => {
  it('antepone el símbolo de dólar', () => {
    expect(formatPrice(0)).toBe('$0');
    expect(formatPrice(23)).toBe('$23');
  });
});

describe('describePlanFeature', () => {
  const es = dictionaries.es.pricing.features;
  const en = dictionaries.en.pricing.features;

  it('cuenta artículos y muestra la duración en minutos u horas según corresponda', () => {
    const free = plan('free').features;
    expect(describePlanFeature(free[0]!, es)).toBe('3 artículos al mes');
    expect(describePlanFeature(free[1]!, es)).toBe('Archivos de hasta 20 min');

    const creator = plan('creator').features;
    expect(describePlanFeature(creator[0]!, es)).toBe('30 artículos al mes');
    expect(describePlanFeature(creator[1]!, es)).toBe('Archivos de hasta 2 h');

    expect(describePlanFeature(plan('pro').features[1]!, en)).toBe('Files up to 4 h');
  });

  it('todas las características de todos los planes tienen texto en es y en, sin marcadores sin sustituir', () => {
    for (const labels of [es, en]) {
      for (const p of PLANS) {
        for (const feature of p.features) {
          const text = describePlanFeature(feature, labels);
          expect(text.length).toBeGreaterThan(0);
          expect(text).not.toContain('{n}');
        }
        for (const key of p.comingSoon) {
          expect(labels[key].length).toBeGreaterThan(0);
        }
      }
    }
  });
});
