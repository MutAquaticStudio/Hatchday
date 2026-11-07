// Tạo một cặp khoá VAPID (ECDSA P-256) cho Web Push. Chạy một lần: node workers/cron/gen-vapid.mjs > vapid.json
//   publicKey  -> biến build VITE_VAPID_PUBLIC_KEY (công khai) và biến VAPID_PUBLIC của Worker
//   privateJwk -> secret VAPID_PRIVATE_JWK của Worker (KHÔNG commit, KHÔNG đưa vào trình duyệt)
import { webcrypto as crypto } from 'node:crypto';
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = Buffer.from(await crypto.subtle.exportKey('raw', kp.publicKey)).toString('base64url');
console.log(JSON.stringify({ publicKey: pub, privateJwk: await crypto.subtle.exportKey('jwk', kp.privateKey) }, null, 2));
