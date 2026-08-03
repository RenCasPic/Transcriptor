import { describe, expect, it, beforeAll } from 'vitest';
import { randomBytes } from 'crypto';
import { encryptSecret, decryptSecret, signState, verifyState } from '@/lib/security/crypto';

beforeAll(() => {
  process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
});

describe('encryptSecret / decryptSecret', () => {
  it('recupera el texto original tras cifrar y descifrar', () => {
    const plaintext = 'refresh-token-de-prueba-123';
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it('genera un IV distinto en cada llamada (ciphertext no determinista)', () => {
    const a = encryptSecret('mismo-texto');
    const b = encryptSecret('mismo-texto');
    expect(a).not.toBe(b);
  });

  it('lanza un error si el payload fue manipulado', () => {
    const encrypted = encryptSecret('secreto');
    const [iv, authTag, ciphertext] = encrypted.split(':');
    const tampered = `${iv}:${authTag}:${Buffer.from('otra-cosa').toString('base64')}`;
    void ciphertext;
    expect(() => decryptSecret(tampered)).toThrow();
  });
});

describe('signState / verifyState', () => {
  it('verifica un state firmado correctamente', () => {
    const payload = JSON.stringify({ workspaceId: 'abc-123', nonce: 'xyz' });
    const signed = signState(payload);
    expect(verifyState(signed)).toBe(payload);
  });

  it('rechaza un state con firma inválida', () => {
    const signed = signState(JSON.stringify({ workspaceId: 'abc-123' }));
    const tampered = signed.slice(0, -2) + 'zz';
    expect(verifyState(tampered)).toBeNull();
  });

  it('rechaza un state malformado', () => {
    expect(verifyState('no-tiene-punto')).toBeNull();
  });
});
