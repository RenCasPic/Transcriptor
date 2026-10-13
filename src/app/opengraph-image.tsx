import { ImageResponse } from 'next/og';
import { es } from '@/lib/i18n/dictionaries/es';

export const alt = 'TalkToPost — De video a artículo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Mismo símbolo que src/components/brand/logo-mark.tsx (versión de trazos normales).
const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<circle cx="32" cy="32" r="29" fill="#4F46E5"/>' +
  '<path d="M11 32L14 26L17.5 38L21 22L24.5 38L28 28L30.5 32" stroke="#FBBF24" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
  '<path d="M30.5 32H52M47.5 27.5L52 32L47.5 36.5M35 24H44M35 40H40" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
  '</svg>';
const LOGO_SRC = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString('base64')}`;

/**
 * Sora (la fuente del nombre de la marca) para la imagen: se pide a Google Fonts
 * con un User-Agent antiguo para que devuelva WOFF/TTF (Satori no lee WOFF2). Si no
 * hay red, se usa la fuente por defecto: la imagen sale igual.
 */
async function loadSora(weight: 500 | 700): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Sora:wght@${weight}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.101 Safari/537.36' },
      })
    ).text();
    const url = /src: url\((.+?)\) format\('(?:opentype|truetype|woff)'\)/.exec(css)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

/** Imagen para compartir el enlace en redes (Open Graph): logo, nombre y lema, sobre fondo claro. */
export default async function OpengraphImage() {
  const [medium, bold] = await Promise.all([loadSora(500), loadSora(700)]);
  const fonts: NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts'] = [];
  if (medium) fonts.push({ name: 'Sora', data: medium, weight: 500, style: 'normal' });
  if (bold) fonts.push({ name: 'Sora', data: bold, weight: 700, style: 'normal' });
  const family = fonts.length > 0 ? 'Sora' : 'sans-serif';

  const tagline = `${es.landing.heroTitle} ${es.landing.heroTitleHighlight}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 96px',
          background: 'linear-gradient(135deg, #EEF2FF 0%, #FAFAFC 55%, #FFF7E6 100%)',
          fontFamily: family,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} width={168} height={168} alt="" />
          <div style={{ display: 'flex', marginLeft: 36, fontSize: 112, letterSpacing: -3, color: '#0F0E1A' }}>
            <span style={{ fontWeight: 500 }}>Talk</span>
            <span style={{ fontWeight: 500, color: '#4F46E5' }}>To</span>
            <span style={{ fontWeight: 700 }}>Post</span>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 56,
            maxWidth: 1010,
            fontSize: 50,
            lineHeight: 1.2,
            fontWeight: 500,
            color: '#3F3D56',
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    // Sin fuentes propias NO se pasa `fonts` (si se pasa vacío, tampoco se carga la fuente por defecto).
    fonts.length > 0 ? { ...size, fonts } : size,
  );
}
