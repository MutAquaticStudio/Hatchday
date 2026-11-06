// Web Push (RFC 8030) cho Cloudflare Worker, chỉ dùng WebCrypto, không phụ thuộc thư viện:
//   - mã hoá nội dung aes128gcm theo RFC 8291 (Message Encryption for Web Push) và RFC 8188;
//   - xác thực VAPID (RFC 8292) bằng JWT ES256.
// Kiểm thử: workers/cron/webpush.test.ts (giải mã bằng bản cài độc lập theo RFC; đã đối chiếu với thư viện web-push khi viết).

const enc = new TextEncoder();
export const b64u = {
  encode: bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  decode: str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)); return Uint8Array.from(s, c => c.charCodeAt(0)); },
};
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };

async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

/** Mã hoá `payload` (Uint8Array) cho thiết bị có khoá công khai p256dh và bí mật auth (base64url). Trả về thân yêu cầu (aes128gcm). */
export async function encryptPayload(payload, p256dh, auth, opts = {}) {
  const uaPublic = b64u.decode(p256dh), authSecret = b64u.decode(auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('p256dh không hợp lệ');
  const eph = opts.ephemeral || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const salt = opts.salt || crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const plain = concat(payload, Uint8Array.of(2)); // 0x02 = bản ghi cuối
  if (plain.length > 4096 - 17) throw new Error('nội dung quá dài');
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, Uint8Array.of(65), asPublic, cipher);
}

/** JWT VAPID ES256. privateJwk: JWK của khoá ECDSA P-256 (có d, x, y). */
export async function vapidJwt(audience, subject, privateJwk, nowSec = Math.floor(Date.now() / 1000)) {
  const head = b64u.encode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u.encode(enc.encode(JSON.stringify({ aud: audience, exp: nowSec + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`)));
  return `${head}.${body}.${b64u.encode(sig)}`;
}

/** Gửi một thông báo. sub: { endpoint, p256dh, auth }; message: object (sẽ thành JSON); vapid: { publicKey (base64url, 65 byte), privateJwk, subject }.
 *  Trả về { ok, status }. 404/410 nghĩa là đăng ký đã hết hạn. */
export async function sendWebPush(sub, message, vapid, fetchFn = fetch) {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub.p256dh, sub.auth);
  const jwt = await vapidJwt(new URL(sub.endpoint).origin, vapid.subject, vapid.privateJwk);
  const res = await fetchFn(sub.endpoint, {
    method: 'POST', body,
    headers: { Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal' },
  });
  return { ok: res.status >= 200 && res.status < 300, status: res.status };
}
