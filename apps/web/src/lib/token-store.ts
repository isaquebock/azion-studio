// AES-GCM token storage no browser.
// - Token cifrado vive em localStorage (sobrevive ao reload).
// - Chave de derivação vive em sessionStorage (perdida ao fechar a aba).
// Logout = limpar localStorage E sessionStorage.

const LS_KEY = "azion_token_v1";
const SS_KEY = "azion_token_key_v1";

function buf2b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b642buf(b64: string): ArrayBuffer {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const cached = sessionStorage.getItem(SS_KEY);
  if (cached) {
    return crypto.subtle.importKey("raw", b642buf(cached), "AES-GCM", true, ["encrypt", "decrypt"]);
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const raw = await crypto.subtle.exportKey("raw", key);
  sessionStorage.setItem(SS_KEY, buf2b64(raw));
  return key;
}

export async function setToken(token: string): Promise<void> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(token),
  );
  localStorage.setItem(
    LS_KEY,
    JSON.stringify({ iv: buf2b64(iv.buffer), ct: buf2b64(ciphertext) }),
  );
}

export async function getToken(): Promise<string | null> {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    const { iv, ct } = JSON.parse(raw) as { iv: string; ct: string };
    const key = await getOrCreateKey();
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b642buf(iv) },
      key,
      b642buf(ct),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

export function clearToken(): void {
  localStorage.removeItem(LS_KEY);
  sessionStorage.removeItem(SS_KEY);
}

export async function tokenLast4(): Promise<string | null> {
  const t = await getToken();
  return t ? t.slice(-4) : null;
}

export function hasStoredToken(): boolean {
  return Boolean(localStorage.getItem(LS_KEY));
}
