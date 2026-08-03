export interface SeoChecklistInput {
  title: string;
  seoTitle: string;
  slug: string;
  metaDescription: string;
  primaryKeyword: string | null;
  html: string;
  wordCount: number;
}

export type SeoChecklistItemId =
  | 'keywordInTitle'
  | 'keywordInIntro'
  | 'keywordInHeading'
  | 'titleLength'
  | 'metaDescription'
  | 'slug'
  | 'wordCount'
  | 'links'
  | 'faq';

export interface SeoChecklistItem {
  id: SeoChecklistItemId;
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
      id: 'keywordInTitle',
      passed: !keyword || input.title.toLowerCase().includes(keyword) || input.seoTitle.toLowerCase().includes(keyword),
    },
    {
      id: 'keywordInIntro',
      passed: !keyword || intro.includes(keyword),
    },
    {
      id: 'keywordInHeading',
      passed: !keyword || headings.includes(keyword),
    },
    {
      id: 'titleLength',
      passed: input.seoTitle.length >= 40 && input.seoTitle.length <= 60,
    },
    {
      id: 'metaDescription',
      passed: input.metaDescription.trim().length > 0,
    },
    {
      id: 'slug',
      passed: input.slug.trim().length > 0,
    },
    {
      id: 'wordCount',
      passed: input.wordCount > 600,
    },
    {
      id: 'links',
      passed: /<a\s/i.test(input.html),
    },
    {
      id: 'faq',
      passed: /preguntas frecuentes|frequently asked questions/i.test(input.html),
    },
  ];
}
