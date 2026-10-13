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
  className,
  nameClassName,
}: {
  /** Mostrar el nombre junto al símbolo (por defecto sí). */
  showName?: boolean;
  /** Lado del símbolo en px; el tamaño de letra del nombre se calcula a partir de él. */
  size?: number;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} className="shrink-0" title={showName ? undefined : 'TalkToPost'} />
      {showName && (
        <span
          className={cn(sora.className, 'whitespace-nowrap leading-none tracking-tight text-foreground', nameClassName)}
          style={{ fontSize: `${Math.round(size * 0.5 * 10) / 10}px` }}
        >
          <span className="font-medium">Talk</span>
          <span className="font-medium text-primary dark:text-[#A5B4FC]">To</span>
          <span className="font-bold">Post</span>
        </span>
      )}
    </span>
  );
}
