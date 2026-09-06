import LZString from 'lz-string';
import { zlibSync,unzlibSync,strToU8,strFromU8 } from 'three/addons/libs/fflate.module.js';

const PREFIX = 'voidwake';
export const COOKIE_CHUNK_SIZE = 3600;
const MAX_CHUNKS = 4;
export type CookieJar = { read: () => string; write: (value: string) => void; path: string; secure: boolean };
function browserJar(): CookieJar | null {
  if (typeof document === 'undefined') return null;
  return {
    read: () => document.cookie,
    write: value => { document.cookie = value; },
    path: new URL('.', window.location.href).pathname,
    secure: window.location.protocol === 'https:',
  };
}
function read(jar: CookieJar, name: string) {
  return jar.read().split(';').map(v => v.trim()).find(v => v.startsWith(name + '='))?.slice(name.length + 1) ?? null;
}
function write(jar: CookieJar, name: string, value: string, remove = false) {
  jar.write(`${name}=${value}; Path=${jar.path}; Max-Age=${remove ? 0 : 31536000}; SameSite=Lax${jar.secure ? '; Secure' : ''}`);
}
function checksum(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}
export function encodeSave(state: unknown) {
 const bytes=zlibSync(strToU8(JSON.stringify(state)),{level:9});
 return 'z.'+btoa(String.fromCharCode(...bytes));
}
export function decodeSave(encoded: string): unknown {
  if (encoded.length > COOKIE_CHUNK_SIZE * MAX_CHUNKS) throw new Error('Save exceeds supported size.');
  const raw = encoded.startsWith('z.')?strFromU8(unzlibSync(Uint8Array.from(atob(encoded.slice(2)),c=>c.charCodeAt(0)),{out:new Uint8Array(100001)})):LZString.decompressFromEncodedURIComponent(encoded);
  if (!raw || raw.length > 100000) throw new Error('Invalid save.');
  return JSON.parse(raw);
}
function fromManifest(jar: CookieJar, manifest: string | null): unknown | null {
  if (!manifest) return null;
  const parts = /^2\.([ab])\.([1-4])\.([a-z0-9]+)$/.exec(manifest);
  if (!parts) return null;
  let encoded = '';
  for (let i = 0; i < Number(parts[2]); i++) {
    const chunk = read(jar, `${PREFIX}_${parts[1]}${i}`);
    if (chunk === null) return null;
    encoded += chunk;
  }
  if (checksum(encoded) !== parts[3]) return null;
  try { return decodeSave(encoded); } catch { return null; }
}
export function loadCookieSave(jar = browserJar()): unknown | null {
  if (!jar) return null;
  try { return fromManifest(jar, read(jar, `${PREFIX}_save`)) ?? fromManifest(jar, read(jar, `${PREFIX}_backup`)); } catch { return null; }
}
export function saveToCookies(state: unknown, jar = browserJar()): boolean {
  if (!jar) return false;
  try {
    const encoded = encodeSave(state);
    const count = Math.ceil(encoded.length / COOKIE_CHUNK_SIZE);
    if (count < 1 || count > MAX_CHUNKS) return false;
    let current = read(jar, `${PREFIX}_save`);
    if (!fromManifest(jar, current)) {
      const backup = read(jar, `${PREFIX}_backup`);
      current = fromManifest(jar, backup) ? backup : null;
    }
    const bank = current?.startsWith('2.a.') ? 'b' : 'a';
    const manifest = `2.${bank}.${count}.${checksum(encoded)}`;
    for (let i = 0; i < count; i++) {
      const chunk = encoded.slice(i * COOKIE_CHUNK_SIZE, (i + 1) * COOKIE_CHUNK_SIZE);
      const name = `${PREFIX}_${bank}${i}`;
      write(jar, name, chunk);
      if (read(jar, name) !== chunk) return false;
    }
    if (!fromManifest(jar, manifest)) return false;
    // Commit the new bank only after every chunk has been read back successfully.
    write(jar, `${PREFIX}_save`, manifest);
    if (read(jar, `${PREFIX}_save`) !== manifest) return false;
    if (current) write(jar, `${PREFIX}_backup`, current);
    for (let i = count; i < MAX_CHUNKS; i++) if (read(jar, `${PREFIX}_${bank}${i}`) !== null) write(jar, `${PREFIX}_${bank}${i}`, '', true);
    return true;
  } catch { return false; }
}
