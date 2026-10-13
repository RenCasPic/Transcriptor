/**
 * Símbolo de TalkToPost: un círculo índigo con una onda de voz amarilla que se
 * convierte en una línea blanca con flecha (de la voz a la publicación) y dos
 * renglones cortos de texto, arriba y abajo.
 *
 * Los mismos trazos están en `scripts/generate-brand-icons.mjs`, que genera los
 * favicons / íconos del manifest: si cambias el símbolo, cámbialo en los dos.
 */

/** Grosor de los trazos: en 32 px o menos se engrosan un poco para que se lean. */
export function logoStrokeWidths(size: number): { wave: number; line: number } {
  return size <= 32 ? { wave: 4, line: 4.6 } : { wave: 3.2, line: 3.4 };
}

export function LogoMark({
  size = 32,
  className,
  title,
}: {
  /** Lado en px. Con 32 o menos se usan los trazos engrosados. */
  size?: number;
  className?: string;
  /** Si se da, el símbolo se anuncia como imagen; si no, se oculta a lectores de pantalla (decorativo). */
  title?: string;
}) {
  const { wave, line } = logoStrokeWidths(size);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <circle cx="32" cy="32" r="29" fill="#4F46E5" />
      <path
        d="M11 32L14 26L17.5 38L21 22L24.5 38L28 28L30.5 32"
        stroke="#FBBF24"
        strokeWidth={wave}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M30.5 32H52M47.5 27.5L52 32L47.5 36.5M35 24H44M35 40H40"
        stroke="#FFFFFF"
        strokeWidth={line}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
