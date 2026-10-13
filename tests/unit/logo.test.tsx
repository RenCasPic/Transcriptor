import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// next/font solo funciona dentro del compilador de Next: aquí se sustituye por un objeto con className.
vi.mock('next/font/google', () => ({ Sora: () => ({ className: 'font-sora-test' }) }));

import { Logo } from '@/components/brand/logo';
import { LogoMark, logoStrokeWidths } from '@/components/brand/logo-mark';

describe('logoStrokeWidths', () => {
  it('engrosa los trazos en 32 px o menos', () => {
    expect(logoStrokeWidths(16)).toEqual({ wave: 4, line: 4.6 });
    expect(logoStrokeWidths(32)).toEqual({ wave: 4, line: 4.6 });
    expect(logoStrokeWidths(33)).toEqual({ wave: 3.2, line: 3.4 });
    expect(logoStrokeWidths(64)).toEqual({ wave: 3.2, line: 3.4 });
  });
});

describe('LogoMark', () => {
  it('dibuja el símbolo (círculo índigo, onda amarilla, línea blanca) con viewBox 64x64', () => {
    const html = renderToStaticMarkup(<LogoMark size={48} />);
    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html).toContain('fill="#4F46E5"');
    expect(html).toContain('stroke="#FBBF24"');
    expect(html).toContain('stroke="#FFFFFF"');
    expect(html).toContain('stroke-width="3.2"');
    expect(html).toContain('stroke-width="3.4"');
  });

  it('en tamaños pequeños usa los trazos engrosados', () => {
    const html = renderToStaticMarkup(<LogoMark size={24} />);
    expect(html).toContain('stroke-width="4"');
    expect(html).toContain('stroke-width="4.6"');
  });

  it('es decorativo salvo que se le dé un título', () => {
    expect(renderToStaticMarkup(<LogoMark />)).toContain('aria-hidden="true"');
    const labeled = renderToStaticMarkup(<LogoMark title="TalkToPost" />);
    expect(labeled).toContain('role="img"');
    expect(labeled).toContain('aria-label="TalkToPost"');
    expect(labeled).not.toContain('aria-hidden');
  });
});

describe('Logo', () => {
  it('con nombre: "Talk" + "To" (color primario, índigo claro en oscuro) + "Post" en negrita', () => {
    const html = renderToStaticMarkup(<Logo />);
    expect(html).toContain('font-sora-test');
    expect(html).toMatch(/<span class="font-medium">Talk<\/span>/);
    expect(html).toMatch(/<span class="font-medium text-primary dark:text-\[#A5B4FC\]">To<\/span>/);
    expect(html).toMatch(/<span class="font-bold">Post<\/span>/);
    // El símbolo es decorativo cuando el nombre ya está escrito al lado.
    expect(html).toContain('aria-hidden="true"');
  });

  it('solo símbolo: sin nombre y anunciado como imagen "TalkToPost"', () => {
    const html = renderToStaticMarkup(<Logo showName={false} />);
    expect(html).not.toContain('Talk</span>');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="TalkToPost"');
  });

  it('el tamaño sale de la variable --logo-size (símbolo y letra proporcionales)', () => {
    const html = renderToStaticMarkup(<Logo size={40} />);
    expect(html).toContain('--logo-size:40px');
    expect(html).toContain('width:var(--logo-size)');
    expect(html).toContain('font-size:0.5em');
  });

  it('con tamaño adaptable el tamaño lo dan las clases (sin variable fija) y los trazos salen de `size`', () => {
    const html = renderToStaticMarkup(<Logo size={44} sizeClassName="[--logo-size:32px] md:[--logo-size:40px]" />);
    expect(html).toContain('[--logo-size:32px] md:[--logo-size:40px]');
    expect(html).not.toContain('--logo-size:44px');
    expect(html).toContain('font-size:var(--logo-size)');
    expect(html).toContain('stroke-width="3.2"');
  });
});
