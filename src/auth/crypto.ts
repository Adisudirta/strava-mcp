const ALGO = 'AES-GCM';
const IV_BYTES = 12;

async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw, { name: ALGO }, false, ['encrypt', 'decrypt']);
}

function toB64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromB64Url(s: string): Uint8Array {
  return Uint8Array.from(
    atob(s.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  );
}

export async function encryptSessionId(sessionId: string, base64Key: string): Promise<string> {
  const key = await importKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    new TextEncoder().encode(sessionId)
  );
  const combined = new Uint8Array(IV_BYTES + ct.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ct), IV_BYTES);
  return toB64Url(combined.buffer);
}

export async function decryptSessionId(token: string, base64Key: string): Promise<string | null> {
  try {
    const buf = fromB64Url(token);
    const iv = buf.slice(0, IV_BYTES);
    const ct = buf.slice(IV_BYTES);
    const key = await importKey(base64Key);
    const plain = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ct);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
