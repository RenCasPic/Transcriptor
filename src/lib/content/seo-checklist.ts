export interface SeoChecklistInput {
  title: string;
  seoTitle: string;
  slug: string;
  metaDescription: string;
  primaryKeyword: string | null;
  html: string;
  wordCount: number;
}

export interface SeoChecklistItem {
  id: string;
  label: string;
  passed: boolean;
}

function extractHeadingsText(html: string): string[] {
  const matches = [...html.matchAll(/<h[23][^>]*>(.*?)<\/h[23]>/gis)];
  return matches.map((m) => m[1]!.replace(/<[^>]+>/g, ''));
}

function extractIntroText(html: string): string {
  const firstParagraph = html.match(/<p[^>]*>(.*?)<\/p>/is);
  return firstParagraph ? firstParagraph[1]!.replace(/<[^>]+>/g, '') : '';
}

export function computeSeoChecklist(input: SeoChecklistInput): SeoChecklistItem[] {
  const keyword = input.primaryKeyword?.trim().toLowerCase();
  const headings = extractHeadingsText(input.html).join(' ').toLowerCase();
  const intro = extractIntroText(input.html).toLowerCase();

  return [
    {
      id: 'keyword_in_title',
      label: 'Palabra clave en el título',
      passed: !keyword || input.title.toLowerCase().includes(keyword) || input.seoTitle.toLowerCase().includes(keyword),
    },
    {
      id: 'keyword_in_intro',
      label: 'Palabra clave en la introducción',
      passed: !keyword || intro.includes(keyword),
    },
    {
      id: 'keyword_in_heading',
      label: 'Palabra clave en al menos un encabezado',
      passed: !keyword || headings.includes(keyword),
    },
    {
      id: 'title_length',
      label: 'Título con longitud adecuada (40-60 caracteres)',
      passed: input.seoTitle.length >= 40 && input.seoTitle.length <= 60,
    },
    {
      id: 'meta_description',
      label: 'Meta description completada',
      passed: input.metaDescription.trim().length > 0,
    },
    {
      id: 'slug',
      label: 'Slug completado',
      passed: input.slug.trim().length > 0,
    },
    {
      id: 'word_count',
      label: 'Artículo con más de 600 palabras',
      passed: input.wordCount > 600,
    },
    {
      id: 'links',
      label: 'Presencia de enlaces',
      passed: /<a\s/i.test(input.html),
    },
    {
      id: 'faq',
      label: 'Presencia de preguntas frecuentes',
      passed: /preguntas frecuentes/i.test(input.html),
    },
  ];
}
