import test from 'node:test';
import assert from 'node:assert/strict';
import { saveToCookies, loadCookieSave, encodeSave, decodeSave, COOKIE_CHUNK_SIZE } from './cookies.ts';
import { Universe, initialState, SAVE_KEY, SYSTEMS } from './engine.ts';
import { parallaxOffset, STAR_LAYERS } from './parallax.ts';

function cookieJar() {
  const entries = new Map(); const writes = [];
  const jar = {
    path: '/voidwake/', secure: true, fail: false, rejectName: '',
    read: () => [...entries].map(([key, value]) => `${key}=${value}`).join('; '),
    write(value) {
      writes.push(value);
      const pair = value.split(';')[0]; const index = pair.indexOf('=');
      const name = pair.slice(0, index), content = pair.slice(index + 1);
      if (jar.fail || name === jar.rejectName || value.length > 4096) return;
      if (value.includes('Max-Age=0')) entries.delete(name); else entries.set(name, content);
    },
  };
  return { jar, entries, writes };
}

test('entire game state roundtrips through compressed cookies', () => {
  const { jar, writes } = cookieJar(); const s = initialState();
  s.x = -1348.22842114213; s.y = 943.554456742; s.angle = 219.354261415;
  s.preferences = { muted: false, zoom: 1.35 }; s.docked = true;
  s.credits = 12832; s.cargo = [8, 1, 2, 0, 0, 0]; s.stocks = { 0: [72, 59, 43, 70, 30, 55] };
  assert.equal(saveToCookies(s, jar), true);
  assert.deepEqual(loadCookieSave(jar), s);
  assert.ok(writes.every(value => value.length < 4096));
  assert.ok(writes.every(value => value.includes('Path=/voidwake/; Max-Age=31536000; SameSite=Lax; Secure')));
  assert.ok(writes.every(value => !value.includes('Domain=')));
});

test('a fully completed campaign fits in small cookies without losing fields', () => {
  const { jar, writes } = cookieJar(); const s = initialState();
  s.ship = 'freighter'; s.upgrades = { weapon: 3, shield: 3, engine: 3, cargo: 3 };
  s.hull = 320; s.shield = 260; s.credits = 3456789; s.visited = SYSTEMS.map(sys => sys.id);
  s.cargo = [25, 20, 20, 20, 20, 20]; s.kills = 934; s.time = 453435.2443253;
  for (const system of SYSTEMS) {
    const g = new Universe(); g.s.system = system.id;
    for (const c of g.offers) { s.contracts.push({ ...c, progress: c.quantity, done: true }); s.completed.push(c.id); }
    s.stocks[system.id] = [140, 15, 34, 52, 32, 46];
  }
  assert.ok(Universe.validate(s));
  assert.equal(saveToCookies(s, jar), true); assert.deepEqual(loadCookieSave(jar), s);
  assert.ok(encodeSave(s).length < COOKIE_CHUNK_SIZE * 2);
  assert.ok(writes.every(cookie => cookie.length < 4096));
});

test('chunked cookie payload reassembles and a failed write does not replace the current save', () => {
  const { jar, entries } = cookieJar();
  let seed = 1229; const random = () => { seed = (seed * 16807) % 2147483647; return seed; };
  const state = { message: Array.from({ length: 850 }, () => random().toString(36)).join(''), credits: 10 };
  assert.ok(encodeSave(state).length > COOKIE_CHUNK_SIZE);
  assert.equal(saveToCookies(state, jar), true); assert.deepEqual(loadCookieSave(jar), state);
  const marker = entries.get('voidwake_save');
  jar.rejectName = 'voidwake_b1';
  assert.equal(saveToCookies({ ...state, credits: 999 }, jar), false);
  assert.equal(entries.get('voidwake_save'), marker);
  assert.deepEqual(loadCookieSave(jar), state);
});

test('corrupted current cookies recover from the previous complete bank', () => {
  const { jar, entries } = cookieJar(); const first = initialState(); const second = { ...first, credits: 3000 };
  saveToCookies(first, jar); saveToCookies(second, jar);
  const bank = entries.get('voidwake_save').split('.')[1];
  entries.set(`voidwake_${bank}0`, 'corrupt');
  assert.deepEqual(loadCookieSave(jar), first);
  jar.rejectName = `voidwake_${bank}0`;
  assert.equal(saveToCookies({ ...first, credits: 8888 }, jar), false);
  assert.deepEqual(loadCookieSave(jar), first, 'a failed repair must preserve the recovered bank');
});

test('blocked cookies surface a failed save instead of claiming success', () => {
  const { jar, entries } = cookieJar(); jar.fail = true;
  assert.equal(saveToCookies(initialState(), jar), false);
  assert.equal(loadCookieSave(jar), null); assert.equal(entries.size, 0);
});

test('a rejected manifest commit preserves the current save', () => {
  const { jar, entries } = cookieJar(); const first = initialState(); saveToCookies(first, jar);
  const marker = entries.get('voidwake_save'); jar.rejectName = 'voidwake_save';
  assert.equal(saveToCookies({ ...first, credits: 5000 }, jar), false);
  assert.equal(entries.get('voidwake_save'), marker); assert.deepEqual(loadCookieSave(jar), first);
});

test('cookie decoding rejects malformed and oversized transfers', () => {
  assert.throws(() => decodeSave('not-a-save'));
  assert.throws(() => decodeSave('x'.repeat(12000)));
  assert.equal(Universe.validate({ ...initialState(), visited: [999] }), null);
  assert.equal(Universe.validate({ ...initialState(), stocks: { 0: [1, -2, 3, 4, 5, 6] } }), null);
  assert.equal(Universe.validate({ ...initialState(), preferences: { muted: false, zoom: NaN } }), null);
  assert.equal(Universe.validate({ ...initialState(), contracts: [{ type: 'delivery', target: 999 }] }), null);
});

test('legacy save migrates only after verified cookie storage', () => {
  const { jar } = cookieJar(); const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document'); const previousWindow = globalThis.window;
  const state = initialState(); state.credits = 4700;
  const values = new Map([[SAVE_KEY, JSON.stringify(state)]]); let legacyWrites = 0;
  globalThis.window = { location: { href: 'https://samcousinsgb.github.io/voidwake/', protocol: 'https:' } };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { get cookie() { return jar.read(); }, set cookie(v) { jar.write(v); } } });
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, removeItem: key => values.delete(key), setItem: () => legacyWrites++ };
  try {
    jar.fail = true; assert.deepEqual(Universe.restore(), state); assert.ok(values.has(SAVE_KEY));
    jar.fail = false; assert.deepEqual(Universe.restore(), state); assert.equal(values.has(SAVE_KEY), false);
    assert.deepEqual(loadCookieSave(jar), state); assert.equal(legacyWrites, 0);
  } finally {
    delete globalThis.localStorage;
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else delete globalThis.document;
    if (previousWindow) globalThis.window = previousWindow; else delete globalThis.window;
  }
});

test('save transfer is lossless across origins', () => {
  const state = initialState(); state.credits = 9400; state.cargo[1] = 10;
  const source = cookieJar(), destination = cookieJar(); destination.jar.path = '/';
  saveToCookies(state, source.jar); const encoded = encodeSave(loadCookieSave(source.jar));
  const imported = Universe.validate(decodeSave(encoded)); assert.ok(imported);
  assert.equal(saveToCookies(imported, destination.jar), true); assert.deepEqual(loadCookieSave(destination.jar), state);
});

test('stars have four distinct parallax depths and remain slower than world objects', () => {
  assert.equal(new Set(STAR_LAYERS.map(layer => layer.depth)).size, 4);
  const cameraTravel = 500;
  for (const layer of STAR_LAYERS) {
    const apparentTravel = cameraTravel - parallaxOffset(cameraTravel, layer.depth);
    assert.ok(apparentTravel > 0 && apparentTravel < cameraTravel);
    assert.ok(Math.abs(apparentTravel - cameraTravel * layer.depth) < .0001);
  }
  assert.ok(STAR_LAYERS[0].depth < STAR_LAYERS[3].depth);
});
