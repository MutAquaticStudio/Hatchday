import { describe, expect, it } from 'vitest';
// @ts-expect-error Worker viết bằng JS thuần
import { b64u, encryptPayload, sendWebPush, vapidJwt } from './webpush.js';

const subtle = crypto.subtle;
const dec = new TextDecoder();
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), len * 8));
}
/** Giải mã phía thiết bị (trình duyệt) theo RFC 8291 mục 3.4, viết độc lập với bản mã hoá. */
async function decrypt(body: Uint8Array, uaPriv: CryptoKey, uaPub: Uint8Array, authSecret: Uint8Array) {
  const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0), idlen = body[20], asPub = body.slice(21, 21 + idlen), cipher = body.slice(21 + idlen);
  expect(rs).toBe(4096); expect(idlen).toBe(65);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []) }, uaPriv, 256));
  const e = new TextEncoder();
  const ikm = await hkdf(authSecret, shared, cat(e.encode('WebPush: info\0'), uaPub, asPub), 32);
  const cek = await hkdf(salt, ikm, e.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hkdf(salt, ikm, e.encode('Content-Encoding: nonce\0'), 12);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cipher));
  expect(plain[plain.length - 1]).toBe(2); // dấu phân cách bản ghi cuối
  return plain.slice(0, -1);
}
async function device() {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey)), auth = crypto.getRandomValues(new Uint8Array(16));
  return { kp, pub, auth, p256dh: b64u.encode(pub), authB64: b64u.encode(auth) };
}

describe('mã hoá Web Push (RFC 8291)', () => {
  it('thiết bị giải mã lại đúng nội dung (gồm tiếng Việt có dấu)', async () => {
    const d = await device(), msg = JSON.stringify({ title: 'Hatchday', body: 'Bé Bánh Bò đói rồi, ghé cho bé ăn nhé.', tag: 'care', url: './?from=push' });
    const body = await encryptPayload(new TextEncoder().encode(msg), d.p256dh, d.authB64);
    expect(dec.decode(await decrypt(body, d.kp.privateKey, d.pub, d.auth))).toBe(msg);
    expect(body.length).toBeLessThanOrEqual(4096);
  });
  it('mỗi lần mã hoá khác nhau (muối và khoá tạm ngẫu nhiên); khoá sai không giải mã được', async () => {
    const d = await device(), e = await device(), p = new TextEncoder().encode('xin chào');
    const a = await encryptPayload(p, d.p256dh, d.authB64), b = await encryptPayload(p, d.p256dh, d.authB64);
    expect(b64u.encode(a)).not.toBe(b64u.encode(b));
    await expect(decrypt(a, e.kp.privateKey, e.pub, e.auth)).rejects.toThrow();
    await expect(decrypt(a, d.kp.privateKey, d.pub, e.auth)).rejects.toThrow(); // sai bí mật auth
  });
  it('từ chối khoá công khai sai và nội dung quá dài', async () => {
    const d = await device();
    await expect(encryptPayload(new Uint8Array(3), b64u.encode(new Uint8Array(65)), d.authB64)).rejects.toThrow('p256dh');
    await expect(encryptPayload(new Uint8Array(5000), d.p256dh, d.authB64)).rejects.toThrow('quá dài');
  });
});

describe('VAPID và gửi', () => {
  it('JWT ES256 có aud/exp/sub đúng và chữ ký kiểm được bằng khoá công khai', async () => {
    const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await subtle.exportKey('jwk', kp.privateKey), now = 1_800_000_000;
    const jwt = await vapidJwt('https://fcm.googleapis.com', 'https://hatchday.noxelis.co', jwk, now), [h, p, s] = jwt.split('.');
    expect(JSON.parse(dec.decode(b64u.decode(h)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(JSON.parse(dec.decode(b64u.decode(p)))).toEqual({ aud: 'https://fcm.googleapis.com', exp: now + 43200, sub: 'https://hatchday.noxelis.co' });
    expect(b64u.decode(s)).toHaveLength(64);
    expect(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, b64u.decode(s), new TextEncoder().encode(`${h}.${p}`))).toBe(true);
  });
  it('sendWebPush: đúng địa chỉ, tiêu đề và thân đã mã hoá; trả trạng thái', async () => {
    const d = await device(), kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const vapid = { publicKey: b64u.encode(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))), privateJwk: await subtle.exportKey('jwk', kp.privateKey), subject: 'https://hatchday.noxelis.co' };
    let seen: { url: string; init: RequestInit } | null = null;
    const r = await sendWebPush({ endpoint: 'https://push.example.com/send/abc', p256dh: d.p256dh, auth: d.authB64 }, { title: 'T', body: 'B' }, vapid, async (url: string, init: RequestInit) => { seen = { url, init }; return new Response(null, { status: 201 }); });
    expect(r).toEqual({ ok: true, status: 201 }); expect(seen!.url).toBe('https://push.example.com/send/abc');
    const hd = seen!.init.headers as Record<string, string>;
    expect(hd['Content-Encoding']).toBe('aes128gcm'); expect(hd.TTL).toBe('86400'); expect(hd.Authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
    expect(dec.decode(await decrypt(seen!.init.body as Uint8Array, d.kp.privateKey, d.pub, d.auth))).toBe(JSON.stringify({ title: 'T', body: 'B' }));
    expect(await sendWebPush({ endpoint: 'https://push.example.com/x', p256dh: d.p256dh, auth: d.authB64 }, { a: 1 }, vapid, async () => new Response(null, { status: 410 }))).toEqual({ ok: false, status: 410 });
  });
});
