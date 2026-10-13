import { Sora } from 'next/font/google';
import { cn } from '@/lib/utils';
import { LogoMark } from './logo-mark';

// Sora solo para el nombre de la marca (el resto de la app usa la fuente del sistema).
const sora = Sora({ subsets: ['latin'], weight: ['500', '700'], display: 'swap' });

/**
 * Logo de TalkToPost: el símbolo solo o junto al nombre. El nombre se escribe
 * "Talk" + "To" (color primario; índigo claro en oscuro) + "Post" en negrita.
 */
export function Logo({
  showName = true,
  size = 32,
  sizeClassName,
  className,
  nameClassName,
}: {
  /** Mostrar el nombre junto al símbolo (por defecto sí). */
  showName?: boolean;
  /** Lado del símbolo en px; el tamaño de letra del nombre sale de él. */
  size?: number;
  /**
   * Tamaño adaptable: clases de Tailwind que definen `--logo-size` por ancho de pantalla, p. ej.
   * `[--logo-size:32px] md:[--logo-size:40px]`. Permite que el logo crezca cuando hay espacio y se
   * encoja en pantallas estrechas sin romper el header. Sustituye a `size` al dibujar; `size` sigue
   * decidiendo el grosor de los trazos.
   */
  sizeClassName?: string;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span
      className={cn('inline-flex items-center gap-[0.25em]', sizeClassName, className)}
      // Sin `sizeClassName`, el tamaño es fijo (`size`); con él, lo dan las clases.
      style={{ ...(sizeClassName ? {} : { '--logo-size': `${size}px` }), fontSize: 'var(--logo-size)' } as React.CSSProperties}
    >
      <LogoMark
        size={size}
        className="shrink-0"
        style={{ width: 'var(--logo-size)', height: 'var(--logo-size)' }}
        title={showName ? undefined : 'TalkToPost'}
      />
      {showName && (
        <span
          className={cn(sora.className, 'whitespace-nowrap leading-none tracking-tight text-foreground', nameClassName)}
          style={{ fontSize: '0.5em' }}
        >
          <span className="font-medium">Talk</span>
          <span className="font-medium text-primary dark:text-[#A5B4FC]">To</span>
          <span className="font-bold">Post</span>
        </span>
      )}
    </span>
  );
}
