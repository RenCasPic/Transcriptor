/**
 * Validación básica para prevenir SSRF (Server-Side Request Forgery) al
 * descargar archivos desde una URL provista por el usuario. Bloquea hosts
 * obviamente internos/privados antes de hacer fetch. No sustituye una
 * validación completa por IP (requeriría resolver DNS), pero cubre los
 * vectores más comunes (localhost, rangos privados, endpoint de metadata de
 * la nube en 169.254.169.254).
 */
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^169\.254\./, // link-local / metadata de proveedores cloud
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /\.local$/i,
];

export function isUrlSafeToFetch(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  const hostname = url.hostname;
  return !BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}
