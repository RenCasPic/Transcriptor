import { describe, expect, it } from 'vitest';
import { sanitizeArticleHtml } from '@/lib/content/sanitize';

describe('sanitizeArticleHtml', () => {
  it('conserva el formato permitido, los enlaces http(s) y data-block-id', () => {
    const html =
      '<h2 data-block-id="s0-h">Título</h2><p data-block-id="s0-b0">Hola <strong>mundo</strong> y <em>más</em>. ' +
      '<a href="https://example.com/a?x=1" target="_blank" rel="noopener noreferrer">enlace</a><br></p>' +
      '<ul><li>uno</li></ul><ol><li>dos</li></ol><blockquote><p>cita</p></blockquote><h3>Sub</h3>';
    const out = sanitizeArticleHtml(html);
    expect(out).toContain('<h2 data-block-id="s0-h">Título</h2>');
    expect(out).toContain('<strong>mundo</strong>');
    expect(out).toContain('href="https://example.com/a?x=1"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('<blockquote>');
    expect(out).toContain('<h3>Sub</h3>');
  });

  it('conserva las imágenes con src http(s) y alt', () => {
    const out = sanitizeArticleHtml('<img src="https://x.supabase.co/a.webp" alt="Una foto" loading="lazy">');
    expect(out).toContain('src="https://x.supabase.co/a.webp"');
    expect(out).toContain('alt="Una foto"');
    expect(out).toContain('loading="lazy"');
  });

  it('elimina scripts, manejadores de eventos y estilos', () => {
    const out = sanitizeArticleHtml(
      '<p onclick="alert(1)" style="color:red">Texto</p><script>alert(2)</script><style>p{}</style><iframe src="https://evil"></iframe>',
    );
    expect(out).toBe('<p>Texto</p>');
  });

  it('bloquea javascript: y data: en enlaces e imágenes', () => {
    const out = sanitizeArticleHtml(
      '<a href="javascript:alert(1)">malo</a><img src="data:image/svg+xml;base64,AAAA" alt="x"><img src="javascript:alert(1)">',
    );
    expect(out).not.toContain('javascript');
    expect(out).not.toContain('data:');
    expect(out).toContain('malo');
  });

  it('quita las etiquetas no permitidas pero conserva su texto', () => {
    expect(sanitizeArticleHtml('<div><span>hola</span> <b>negrita</b></div>')).toBe('hola negrita');
  });

  it('no deja pasar enlaces relativos al protocolo (//evil.com)', () => {
    expect(sanitizeArticleHtml('<a href="//evil.example.com">x</a>')).not.toContain('evil.example.com');
  });
});
