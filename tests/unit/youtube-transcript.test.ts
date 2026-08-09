import { describe, expect, it } from 'vitest';
import { extractYoutubeVideoId, isValidYoutubeVideoId } from '@/lib/integrations/youtube-transcript';

describe('extractYoutubeVideoId', () => {
  it('extrae el ID de una URL /watch estándar', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extrae el ID cuando hay otros parámetros antes de v=', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ&t=30s')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  it('extrae el ID de un enlace corto youtu.be', () => {
    expect(extractYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extrae el ID de un enlace youtu.be con parámetros', () => {
    expect(extractYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ');
  });

  it('extrae el ID de un Short', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extrae el ID de un enlace /embed/', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extrae el ID sin www', () => {
    expect(extractYoutubeVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('devuelve null para una URL que no es de YouTube', () => {
    expect(extractYoutubeVideoId('https://example.com/video')).toBeNull();
  });

  it('devuelve null para una URL malformada', () => {
    expect(extractYoutubeVideoId('no-es-una-url')).toBeNull();
  });

  it('devuelve null para la home de YouTube sin video', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/')).toBeNull();
  });

  it('devuelve null si el valor de v= no tiene forma de ID de video (defensa contra inyección de URL)', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=<script>alert(1)</script>')).toBeNull();
  });

  it('devuelve null si el valor de v= es demasiado corto', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=abc')).toBeNull();
  });
});

describe('isValidYoutubeVideoId', () => {
  it('acepta un ID válido de 11 caracteres', () => {
    expect(isValidYoutubeVideoId('dQw4w9WgXcQ')).toBe(true);
  });

  it('acepta IDs con guiones y guiones bajos', () => {
    expect(isValidYoutubeVideoId('a-b_c-d_e-f')).toBe(true);
  });

  it('rechaza un ID demasiado corto', () => {
    expect(isValidYoutubeVideoId('abc')).toBe(false);
  });

  it('rechaza un ID con caracteres no permitidos', () => {
    expect(isValidYoutubeVideoId('dQw4w9WgX/Q')).toBe(false);
  });
});
