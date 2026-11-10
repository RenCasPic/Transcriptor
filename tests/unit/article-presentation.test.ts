import { describe, expect, it } from 'vitest';
import { caseSectionFor, decorateArticleHtml, isArticleViewType } from '@/lib/content/article-presentation';

describe('decorateArticleHtml', () => {
  it('no cambia nada para tipos sin marcado especial ni sin tipo', () => {
    const html = '<h2>Paso 1: algo</h2><p>Texto</p>';
    expect(decorateArticleHtml(html, 'guide')).toBe(html);
    expect(decorateArticleHtml(html, null)).toBe(html);
    expect(decorateArticleHtml('', 'tutorial')).toBe('');
  });

  it('tutorial: marca los encabezados "Paso N: …" con insignia y conserva el texto', () => {
    const out = decorateArticleHtml('<h2 data-block-id="b1">Paso 2: Sube el archivo</h2><p>x</p>', 'tutorial');
    expect(out).toContain('class="step-heading"');
    expect(out).toContain('data-block-id="b1"');
    expect(out).toContain('<span class="step-badge"><span class="sr-only">Paso </span>2</span>');
    expect(out).toContain('<span>Sube el archivo</span>');
  });

  it('tutorial: reconoce "Step N" en inglés y no toca otros encabezados', () => {
    expect(decorateArticleHtml('<h2>Step 1 - Install</h2>', 'tutorial')).toContain('step-badge');
    expect(decorateArticleHtml('<h2>Introducción</h2>', 'tutorial')).toBe('<h2>Introducción</h2>');
  });

  it('tutorial: respeta una clase existente del encabezado', () => {
    expect(decorateArticleHtml('<h2 class="x">Paso 1: A</h2>', 'tutorial')).toContain('class="x step-heading"');
  });

  it('lista: convierte "3. …" en un número grande de dos cifras', () => {
    const out = decorateArticleHtml('<h2>3. Tercer elemento</h2><h2>Conclusión</h2>', 'list');
    expect(out).toContain('<span class="item-num">03</span>');
    expect(out).toContain('<span>Tercer elemento</span>');
    expect(out).toContain('<h2>Conclusión</h2>');
  });

  it('caso de estudio: clasifica las secciones en español e inglés', () => {
    expect(caseSectionFor('Contexto')).toBe('context');
    expect(caseSectionFor('El problema')).toBe('problem');
    expect(caseSectionFor('Solución aplicada')).toBe('solution');
    expect(caseSectionFor('Resultados')).toBe('results');
    expect(caseSectionFor('Aprendizajes')).toBe('lessons');
    expect(caseSectionFor('Lessons learned')).toBe('lessons');
    expect(caseSectionFor('Preguntas frecuentes')).toBeNull();

    const out = decorateArticleHtml('<h2>Resultados</h2><h2>Preguntas frecuentes</h2>', 'case_study');
    expect(out).toContain('<h2 class="case-heading" data-case="results">Resultados</h2>');
    expect(out).toContain('<h2>Preguntas frecuentes</h2>');
  });

  it('preguntas y respuestas: marca solo los encabezados que son preguntas', () => {
    const out = decorateArticleHtml('<h2>¿Cuánto cuesta?</h2><h2>Conclusión</h2>', 'qa');
    expect(out).toContain('<h2 class="qa-question">¿Cuánto cuesta?</h2>');
    expect(out).toContain('<h2>Conclusión</h2>');
  });

  it('isArticleViewType valida los tipos conocidos', () => {
    expect(isArticleViewType('qa')).toBe(true);
    expect(isArticleViewType('otro')).toBe(false);
    expect(isArticleViewType(null)).toBe(false);
  });
});
