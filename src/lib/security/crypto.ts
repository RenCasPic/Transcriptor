import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Cifrado simétrico (AES-256-GCM) para credenciales de integraciones
 * (`integrations.encrypted_credentials`) usando Node `crypto`, sin
 * dependencias adicionales. La clave es `INTEGRATIONS_ENCRYPTION_KEY`
 * (32 bytes en base64). Nunca se usa en el cliente.
 */
function getEncryptionKey(): Buffer {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('INTEGRATIONS_ENCRYPTION_KEY_MISSING');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('INTEGRATIONS_ENCRYPTION_KEY_INVALID_LENGTH');
  }
  return key;
}

/** Cifra texto plano en el formato "iv:authTag:ciphertext" (cada parte en base64). */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** Descifra un payload generado por `encryptSecret`. */
export function decryptSecret(payload: string): string {
  const key = getEncryptionKey();
  const [ivPart, authTagPart, ciphertextPart] = payload.split(':');
  if (!ivPart || !authTagPart || !ciphertextPart) {
    throw new Error('ENCRYPTED_PAYLOAD_MALFORMED');
  }

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/**
 * Firma un payload (usado en el parámetro `state` del flujo OAuth) con HMAC-SHA256
 * para detectar manipulación en el callback. Formato: "payloadBase64.signatureBase64".
 */
export function signState(payload: string): string {
  const key = getEncryptionKey();
  const payloadBase64 = Buffer.from(payload, 'utf8').toString('base64url');
  const signature = createHmac('sha256', key).update(payloadBase64).digest('base64url');
  return `${payloadBase64}.${signature}`;
}

/** Verifica y decodifica un `state` firmado con `signState`. Devuelve `null` si es inválido. */
export function verifyState(signedState: string): string | null {
  const [payloadBase64, signature] = signedState.split('.');
  if (!payloadBase64 || !signature) {
    return null;
  }

  const key = getEncryptionKey();
  const expectedSignature = createHmac('sha256', key).update(payloadBase64).digest('base64url');
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  return Buffer.from(payloadBase64, 'base64url').toString('utf8');
}
