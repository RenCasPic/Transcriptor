/**
 * Presentación visual por TIPO de artículo (vista previa y página pública).
 *
 * La mayor parte del estilo es CSS puro (`.article-view[data-content-type=...]`
 * en globals.css). Aquí solo se "marcan" los encabezados H2 que el CSS no puede
 * reconocer por sí solo: los pasos de un tutorial ("Paso 2: …"), los elementos
 * numerados de una lista ("3. …"), las secciones de un caso de estudio
 * (contexto, problema, solución…) y las preguntas de un Q&A.
 *
 * Es una transformación SOLO de presentación sobre HTML que ya es de confianza
 * (el que genera el servidor o el editor): el texto se conserva tal cual y los
 * únicos atributos que se añaden los fija esta función. No se guarda en la base
 * de datos, así que los artículos existentes también la reciben.
 */

const CONTENT_TYPES = ['tutorial', 'guide', 'list', 'interview', 'summary', 'case_study', 'opinion', 'qa'] as const;
export type ArticleViewType = (typeof CONTENT_TYPES)[number];

export function isArticleViewType(value: unknown): value is ArticleViewType {
  return typeof value === 'string' && (CONTENT_TYPES as readonly string[]).includes(value);
}

const H2_RE = /<h2((?:\s[^>]*)?)>([\s\S]*?)<\/h2>/g;
const STEP_RE = /^(Paso|Step)\s+(\d+)\s*[:.\-–—]\s*([\s\S]+)$/i;
const ITEM_RE = /^(\d{1,3})\s*[.)]\s+([\s\S]+)$/;

export type CaseSection = 'context' | 'problem' | 'solution' | 'results' | 'lessons';

const CASE_SECTIONS: Array<[CaseSection, RegExp]> = [
  ['context', /\b(contexto|context|background|antecedentes)\b/],
  ['problem', /\b(problema|desafio|reto|challenge|problem)\b/],
  ['solution', /\b(solucion|solution|approach|enfoque)\b/],
  ['results', /\b(resultados?|results?|impacto|impact|outcomes?)\b/],
  ['lessons', /\b(aprendizajes?|lecciones?|lessons?|learnings?|takeaways?|conclusiones?|conclusion)\b/],
];

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Clasifica el encabezado de un caso de estudio (null si no es ninguna sección conocida). */
export function caseSectionFor(headingText: string): CaseSection | null {
  const text = normalize(headingText);
  for (const [section, pattern] of CASE_SECTIONS) {
    if (pattern.test(text)) return section;
  }
  return null;
}

function withClass(attrs: string, className: string, extra = ''): string {
  if (/\sclass="/.test(attrs)) {
    return `${attrs.replace(/\sclass="([^"]*)"/, (_m, existing: string) => ` class="${existing} ${className}"`)}${extra}`;
  }
  return `${attrs} class="${className}"${extra}`;
}

/** Devuelve el HTML con los encabezados marcados según el tipo de artículo (sin cambios si el tipo no lo necesita). */
export function decorateArticleHtml(html: string, contentType: string | null | undefined): string {
  if (!html) return html;

  switch (contentType) {
    case 'tutorial':
      return html.replace(H2_RE, (match, attrs: string, inner: string) => {
        const step = inner.match(STEP_RE);
        if (!step) return match;
        const [, label, number, rest] = step;
        return `<h2${withClass(attrs, 'step-heading')}><span class="step-badge"><span class="sr-only">${label} </span>${number}</span><span>${rest}</span></h2>`;
      });

    case 'list':
      return html.replace(H2_RE, (match, attrs: string, inner: string) => {
        const item = inner.match(ITEM_RE);
        if (!item) return match;
        const [, number, rest] = item;
        return `<h2${withClass(attrs, 'item-heading')}><span class="item-num">${number!.padStart(2, '0')}</span><span>${rest}</span></h2>`;
      });

    case 'case_study':
      return html.replace(H2_RE, (match, attrs: string, inner: string) => {
        const section = caseSectionFor(stripTags(inner));
        if (!section) return match;
        return `<h2${withClass(attrs, 'case-heading', ` data-case="${section}"`)}>${inner}</h2>`;
      });

    case 'qa':
      return html.replace(H2_RE, (match, attrs: string, inner: string) => {
        if (!/[?？]$/.test(stripTags(inner))) return match;
        return `<h2${withClass(attrs, 'qa-question')}>${inner}</h2>`;
      });

    default:
      return html;
  }
}
