export interface CoverImageResult {
  url: string;
  alt: string;
}

/**
 * Busca una imagen de portada gratuita en Pexels (https://www.pexels.com/api),
 * a partir del tema del artículo. Requiere una API key gratuita (sin tarjeta
 * de crédito, aprobación instantánea) en PEXELS_API_KEY. Sin clave
 * configurada, o si la búsqueda falla, devuelve null y el artículo se guarda
 * sin imagen de portada (no rompe la generación).
 */
export async function searchCoverImage(query: string): Promise<CoverImageResult | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey || !query.trim()) return null;

  try {
    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.set('query', query.trim().slice(0, 100));
    url.searchParams.set('per_page', '1');
    url.searchParams.set('orientation', 'landscape');

    const response = await fetch(url.toString(), {
      headers: { authorization: apiKey },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      photos?: Array<{ src?: { large?: string; landscape?: string }; alt?: string; photographer?: string }>;
    };
    const photo = data.photos?.[0];
    const photoUrl = photo?.src?.landscape ?? photo?.src?.large;
    if (!photoUrl) return null;

    return {
      url: photoUrl,
      alt: photo?.alt?.trim() || query.trim(),
    };
  } catch {
    return null;
  }
}
