// Chế độ hình ảnh "Điện ảnh" (bản máy tính / Steam): thay lối vẽ hoạt hình bằng dựng hình vật lý.
//   - Vật liệu PBR (gỗ, tường, vải, gốm, kim loại, lá, nước…) với hoạ tiết pháp tuyến/độ nhám sinh bằng code
//   - Bầu trời vẽ trong cảnh (mặt trời, mây, sao) và ánh sáng môi trường (PMREM) lấy từ chính bầu trời đó
//   - Lông cho bé bằng nhiều lớp vỏ (shell fur), bóng mềm 4096, đổ bóng tiếp xúc GTAO
//   - Hậu kỳ HDR: độ sâu trường ảnh theo tiêu cự, bloom, tone mapping, chỉnh màu, vignette, hạt phim; MSAA 4×
// Chọn bằng Cài đặt → Hình ảnh → Điện ảnh (lưu 'hatchday-quality' = 'dienanh', tải lại trang), hoặc ?gfx=cine để thử.
// Bản Steam mặc định bật; bản web mặc định vẫn là hoạt hình (nhẹ, hợp điện thoại). Mọi thứ ở đây chỉ chạy khi bật.
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** Người chơi có đang chọn chế độ Điện ảnh không (quyết định một lần lúc mở game vì vật liệu dựng theo chế độ). */
export function cineWanted(isSteam) {
  try {
    const u = new URLSearchParams(location.search).get('gfx'); if (u === 'cine') return true; if (u === 'toon') return false;
    const q = localStorage.getItem('hatchday-quality'); if (q) return q === 'dienanh';
  } catch { /* bỏ qua */ }
  return !!isSteam;
}

/* ---------- nhiễu và hoạ tiết sinh bằng code ---------- */
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function valueNoise(x, y, wrap) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, m = v => ((v % wrap) + wrap) % wrap;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(m(xi), m(yi)), b = hash2(m(xi + 1), m(yi)), c = hash2(m(xi), m(yi + 1)), d = hash2(m(xi + 1), m(yi + 1));
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** fbm lặp được (tile) trên ô [0,1)². */
function fbm(u, v, base, oct = 4) { let s = 0, a = 0.5, f = base; for (let i = 0; i < oct; i++) { s += a * valueNoise(u * f, v * f, f); a *= 0.5; f *= 2; } return s; }

export function createCine({ THREE, renderer, scene, camera, shared }) {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  /** Tạo cặp hoạ tiết (pháp tuyến, độ nhám) từ hàm chiều cao h(u,v) ∈ [0,1] lặp được. */
  function heightMaps(size, heightFn, { strength = 2, roughFn = null } = {}) {
    const H = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) H[y * size + x] = heightFn(x / size, y / size);
    const nrm = new Uint8Array(size * size * 4), rgh = roughFn ? new Uint8Array(size * size * 4) : null;
    const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
      nrm[i] = (-dx / l * 0.5 + 0.5) * 255; nrm[i + 1] = (-dy / l * 0.5 + 0.5) * 255; nrm[i + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
      if (rgh) { const r = Math.max(0, Math.min(1, roughFn(x / size, y / size, H[y * size + x]))) * 255; rgh[i] = rgh[i + 1] = rgh[i + 2] = r; rgh[i + 3] = 255; }
    }
    const mk = data => { const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = maxAniso; t.needsUpdate = true; return t; };
    return { normal: mk(nrm), rough: rgh ? mk(rgh) : null };
  }
  const withRepeat = (tex, rx, ry) => { if (!tex) return null; const t = tex.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return t; };

  // hạt mịn cho bề mặt sơn / nhựa / đất nặn: phá vẻ "phẳng lì máy tính"
  const micro = heightMaps(256, (u, v) => fbm(u, v, 24, 3), { strength: 2.2 });
  // vân gỗ: 4 tấm ván mỗi ô (khớp woodTex cũ), khe ván lõm, thớ chạy dọc tấm
  const wood = heightMaps(512, (u, v) => {
    const row = Math.floor(v * 4), fv = v * 4 - row, off = hash2(row, 7) , uu = u + off;
    const gap = Math.min(fv, 1 - fv) < 0.035 ? 0 : 1, end = ((uu * 1.0) % 1 + 1) % 1 < 0.012 ? 0 : 1;
    const grain = fbm(uu * 1 , v * 4 + row * 3.1, 3, 3) * 0.5 + Math.sin((v * 4 + fbm(uu, v, 5, 2) * 0.35) * 150) * 0.08 + fbm(u * 6, v * 40, 8, 2) * 0.18;
    return (0.55 + grain * 0.4) * gap * end;
  }, { strength: 3.4, roughFn: (u, v, h) => (h < 0.1 ? 0.95 : 0.34 + fbm(u, v, 12, 3) * 0.3) });
  // vải dệt (thảm, nệm, gối)
  const fabric = heightMaps(256, (u, v) => 0.5 + 0.25 * Math.sin(u * Math.PI * 2 * 48) * Math.sin(v * Math.PI * 2 * 48) + fbm(u, v, 32, 2) * 0.3, { strength: 3 });
  // tường sơn / giấy dán: sần nhẹ
  const plaster = heightMaps(256, (u, v) => fbm(u, v, 10, 4) * 0.7 + fbm(u, v, 60, 2) * 0.3, { strength: 1.6 });
  // thớ gỗ mịn cho đồ gỗ (kệ, bàn, ghế): không có khe ván
  const grain = heightMaps(256, (u, v) => 0.5 + Math.sin((v + fbm(u, v, 4, 2) * 0.12) * Math.PI * 2 * 22) * 0.22 + fbm(u * 2, v * 14, 6, 2) * 0.3, { strength: 2.4 });
  // đất / cỏ / đá lát
  const ground = heightMaps(256, (u, v) => fbm(u, v, 8, 5), { strength: 4 });

  /** Thông số theo loại bề mặt. Mặc định "clay": đồ chơi sơn mờ. */
  const KINDS = {
    clay:    { roughness: 0.58, metalness: 0, n: micro.normal, ns: 0.22, rep: 3 },
    wood:    { roughness: 1, metalness: 0, n: wood.normal, r: wood.rough, ns: 1.0, clearcoat: 0.35, ccRough: 0.32 },
    wall:    { roughness: 0.92, metalness: 0, n: plaster.normal, ns: 0.5, rep: 4 },
    fabric:  { roughness: 1, metalness: 0, n: fabric.normal, ns: 0.9, rep: 6, sheen: 0.8 },
    ceramic: { roughness: 0.16, metalness: 0, clearcoat: 1, ccRough: 0.06 },
    plastic: { roughness: 0.3, metalness: 0, clearcoat: 0.4, ccRough: 0.2 },
    metal:   { roughness: 0.28, metalness: 1 },
    leaf:    { roughness: 0.62, metalness: 0, n: micro.normal, ns: 0.4, rep: 2, sheen: 0.35 },
    ground:  { roughness: 0.97, metalness: 0, n: ground.normal, ns: 1.2, rep: 10 },
    stone:   { roughness: 0.8, metalness: 0, n: ground.normal, ns: 0.7, rep: 6 },
    glass:   { roughness: 0.04, metalness: 0, transmission: 0.9, thickness: 0.3, ior: 1.45 },
    water:   { roughness: 0.05, metalness: 0, clearcoat: 1, ccRough: 0.03, n: ground.normal, ns: 0.3, rep: 3 }, // không dùng transmission: tốn thêm một lượt vẽ cả cảnh
    timber:  { roughness: 0.5, metalness: 0, n: grain.normal, ns: 0.55, rep: 2, clearcoat: 0.25, ccRough: 0.35 },
  };
  /** Vật không khai loại bề mặt thì đoán theo màu: nâu vàng là gỗ, xanh lá là lá cây, xám đậm là nhựa bóng, còn lại là đồ sơn mờ. */
  const hsl = { h: 0, s: 0, l: 0 }, tmpC = new THREE.Color();
  function guessKind(color) {
    tmpC.set(color).getHSL(hsl); const h = hsl.h * 360;
    if (hsl.s > 0.3 && h >= 18 && h <= 42 && hsl.l > 0.3 && hsl.l < 0.86) return 'timber';
    if (hsl.s > 0.25 && h >= 85 && h <= 160) return 'leaf';
    if (hsl.s < 0.25 && hsl.l < 0.42) return 'plastic';
    return 'clay';
  }
  /** Vật liệu thay cho toon(color, map): cùng chữ ký, thêm `kind` tuỳ chọn. */
  function mat(color, map, kind) {
    if (!kind) kind = map ? 'clay' : guessKind(color);
    const k = KINDS[kind] || KINDS.clay;
    const physical = k.clearcoat || k.sheen || k.transmission;
    const m = physical ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
    m.color.set(color); m.roughness = k.roughness; m.metalness = k.metalness; m.map = map || null;
    if (map) map.anisotropy = maxAniso;
    if (k.n) {
      // hoạ tiết có map đi kèm thì lặp theo map (sàn gỗ, giấy dán tường); không thì lặp theo loại
      m.normalMap = map && kind === 'wood' ? withRepeat(k.n, map.repeat.x, map.repeat.y) : map && kind !== 'wood' ? withRepeat(k.n, map.repeat.x * 2, map.repeat.y * 2) : withRepeat(k.n, k.rep || 1, k.rep || 1);
      m.normalScale.set(k.ns, k.ns);
    }
    if (k.r) m.roughnessMap = map ? withRepeat(k.r, map.repeat.x, map.repeat.y) : k.r;
    if (k.clearcoat) { m.clearcoat = k.clearcoat; m.clearcoatRoughness = k.ccRough; }
    if (k.sheen) { m.sheen = k.sheen; m.sheenRoughness = 0.6; m.sheenColor.set(color).lerp(new THREE.Color('#ffffff'), 0.45); }
    if (k.transmission) { m.transmission = k.transmission; m.thickness = k.thickness; m.ior = k.ior; m.transparent = kind === 'glass'; }
    m.userData.k = kind;
    return m;
  }

  /* ---------- lông: nhiều lớp vỏ (shell) vẽ instanced, mỗi sợi là một ô nhiễu 3D trên bề mặt ---------- */
  const FUR_VERT = `
    vec4 mvPosition = vec4( transformed, 1.0 );
    #ifdef USE_INSTANCING
      mvPosition = instanceMatrix * mvPosition;
    #endif
    mvPosition = modelViewMatrix * mvPosition;
    {
      float fh = aLayer;
      vec3 fn = normalize( transformedNormal );
      vec3 gv = normalize( ( viewMatrix * vec4( 0.0, -1.0, 0.0, 0.0 ) ).xyz );
      float fm = 1.0;
      if ( furFace > 0.5 ) {
        vec3 d = normalize( position );
        float az = abs( atan( d.x, d.z ) ), el = acos( clamp( d.y, -1.0, 1.0 ) );
        float e = length( vec2( az / 0.9, ( el - 1.42 ) / 0.8 ) );
        fm = smoothstep( 0.62, 1.05, e );
      }
      vFurM = fm; vFurH = fh; vFurP = position;
      float sway = sin( furTime * 1.7 + position.x * 5.0 + position.y * 3.0 ) * 0.06;
      vec3 dir = normalize( fn + gv * ( furDroop + sway ) * fh );
      mvPosition.xyz += dir * furLen * fh * fm;
    }
    gl_Position = projectionMatrix * mvPosition;
  `;
  const FUR_FRAG = `
    {
      float fh = vFurH;
      vec3 fp = normalize( vFurP ) * furDensity + vec3( 0.0, -0.5, 0.0 ) * fh;
      vec3 cell = floor( fp ), ff = fract( fp ) - 0.5;
      float rnd = fract( sin( dot( cell, vec3( 127.1, 311.7, 74.7 ) ) ) * 43758.5453 );
      vec3 jit = vec3( fract( rnd * 57.31 ), fract( rnd * 13.7 ), fract( rnd * 91.3 ) ) - 0.5;
      float maxH = mix( 0.5, 1.0, rnd );
      float rad = 0.66 * ( 1.0 - fh / maxH );
      float fa = fh <= 0.0 ? 1.0 : smoothstep( rad + 0.07, rad - 0.07, length( ff + jit * 0.35 ) ) * step( fh, maxH );
      if ( fh > 0.0 && ( vFurM < 0.03 || fa < 0.02 ) ) discard;
      diffuseColor.a = fa;
      diffuseColor.rgb *= mix( 0.42, 1.16, pow( fh, 0.65 ) ) * ( 0.93 + 0.14 * rnd );
    }
  `;
  const furTime = { value: 0 };
  function furMaterial(color, { len, density, face, glow }) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });
    m.alphaToCoverage = true;
    const u = { furLen: { value: len }, furDensity: { value: density }, furDroop: { value: 0.32 }, furFace: { value: face ? 1 : 0 }, furTime, evoGlow: glow };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'attribute float aLayer;\nuniform float furLen, furDroop, furFace, furTime;\nvarying float vFurH, vFurM;\nvarying vec3 vFurP;\n' + sh.vertexShader.replace('#include <project_vertex>', FUR_VERT);
      sh.fragmentShader = 'uniform float furDensity, evoGlow;\nvarying float vFurH, vFurM;\nvarying vec3 vFurP;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + FUR_FRAG)
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( 1.0, 0.98, 0.94 ), evoGlow );');
    };
    m.customProgramCacheKey = () => 'cine-fur';
    return m;
  }
  /** Vật liệu thân bé: lớp nền tối dưới chân lông; các lớp lông gắn sau bằng addFur. */
  function petMat(color) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }); // màu đủ sáng để ảnh thu nhỏ (không có lớp lông) vẫn đúng màu
    m.userData.fur = color; m.userData.k = 'fur';
    const glow = shared.evoGlow;
    m.onBeforeCompile = sh => { sh.uniforms.evoGlow = glow; sh.fragmentShader = 'uniform float evoGlow;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( 1.0, 0.98, 0.94 ), evoGlow );'); };
    m.customProgramCacheKey = () => 'cine-pet-base';
    return m;
  }
  /** Gắn các lớp lông lên mọi phần thân của một con thú (root). `faceMesh`: khối mang khuôn mặt (lông thưa dần quanh mặt). */
  function addFur(root, faceMesh, layers = 22) {
    const tmp = new THREE.Vector3(), list = [];
    root.updateMatrixWorld(true);
    root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !o.userData.outline && o.material && o.material.userData.fur) list.push(o); });
    for (const o of list) {
      o.geometry.computeBoundingSphere();
      const ws = o.getWorldScale(tmp), sc = Math.max(ws.x, ws.y, ws.z), R = o.geometry.boundingSphere.radius * sc;
      const L = Math.max(6, Math.round(layers * Math.min(1, 0.45 + R)));
      const geo = new THREE.BufferGeometry(); geo.index = o.geometry.index; // dùng chung bộ đệm đỉnh với thân, chỉ thêm thuộc tính lớp theo instance
      for (const k in o.geometry.attributes) geo.setAttribute(k, o.geometry.attributes[k]);
      geo.boundingSphere = o.geometry.boundingSphere.clone();
      const layer = new Float32Array(L); for (let i = 0; i < L; i++) layer[i] = (i + 1) / L;
      geo.setAttribute('aLayer', new THREE.InstancedBufferAttribute(layer, 1));
      const fm = furMaterial(o.material.userData.fur, { len: Math.min(0.085, 0.03 + R * 0.055), density: Math.max(26, R * 92), face: o === faceMesh, glow: shared.evoGlow });
      const shellMesh = new THREE.InstancedMesh(geo, fm, L);
      const I = new THREE.Matrix4(); for (let i = 0; i < L; i++) shellMesh.setMatrixAt(i, I);
      shellMesh.userData.fur = true; shellMesh.userData.noAO = true; shellMesh.userData.noShadow = true; shellMesh.castShadow = false; shellMesh.receiveShadow = true;
      shellMesh.frustumCulled = false; shellMesh.raycast = () => {};
      o.add(shellMesh);
    }
  }

  /* ---------- bầu trời trong cảnh + ánh sáng môi trường ---------- */
  const skyU = {
    uTop: { value: new THREE.Color('#63c4ff') }, uHorizon: { value: new THREE.Color('#cdf1ff') }, uSunDir: { value: new THREE.Vector3(0.35, 0.7, 0.6).normalize() },
    uSunCol: { value: new THREE.Color('#fff3d6') }, uNight: { value: 0 }, uCloud: { value: 0.45 }, uGray: { value: 0 }, uTime: { value: 0 },
  };
  const SKY_FRAG = `
    uniform vec3 uTop, uHorizon, uSunDir, uSunCol; uniform float uNight, uCloud, uGray, uTime;
    varying vec3 vDir;
    float h21( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
    float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( h21( i ), h21( i + vec2( 1, 0 ) ), f.x ), mix( h21( i + vec2( 0, 1 ) ), h21( i + vec2( 1, 1 ) ), f.x ), f.y ); }
    float fbm( vec2 p ) { float s = 0.0, a = 0.5; for ( int i = 0; i < 5; i++ ) { s += a * vn( p ); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
    void main() {
      vec3 d = normalize( vDir );
      float t = clamp( d.y * 0.5 + 0.5, 0.0, 1.0 );
      vec3 col = mix( uHorizon, uTop, smoothstep( 0.48, 0.95, t ) );
      col = mix( col, uHorizon * 0.82, smoothstep( 0.5, 0.2, t ) );
      float sd = max( dot( d, normalize( uSunDir ) ), 0.0 );
      vec3 disc = uSunCol * ( smoothstep( 0.9992, 0.9997, sd ) * mix( 26.0, 5.0, uNight ) + pow( sd, 220.0 ) * 2.2 + pow( sd, 12.0 ) * mix( 0.5, 0.12, uNight ) );
      if ( d.y > 0.0 ) {
        vec2 cp = d.xz / ( d.y + 0.22 ) * 1.5 + vec2( uTime * 0.006, 0.0 );
        float c = smoothstep( 1.0 - uCloud * 0.75, 1.15 - uCloud * 0.3, fbm( cp ) + 0.42 * fbm( cp * 3.1 ) ) * smoothstep( 0.0, 0.16, d.y );
        vec3 cc = mix( vec3( 1.0 ), uSunCol, 0.35 ) * mix( 1.25, 0.2, uNight ) * mix( 1.0, 0.62, uGray );
        float shade = smoothstep( 0.2, 0.9, fbm( cp + normalize( uSunDir ).xz * 0.25 ) );
        col = mix( col + disc * ( 1.0 - c ), cc * mix( 1.0, 0.72, shade ), c * 0.92 );
        float st = step( 0.9975, h21( floor( d.xz / ( d.y + 0.35 ) * 140.0 ) ) ) * uNight * ( 1.0 - c );
        col += vec3( st * 2.2 );
      }
      col = mix( col, vec3( dot( col, vec3( 0.33 ) ) ) * vec3( 0.86, 0.9, 0.98 ), uGray );
      gl_FragColor = vec4( col, 1.0 );
    }
  `;
  const skyMat = new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
    vertexShader: 'varying vec3 vDir;\nvoid main() { vDir = position; vec4 p = modelViewMatrix * vec4( position, 0.0 ); gl_Position = ( projectionMatrix * vec4( p.xyz, 1.0 ) ).xyww; }', fragmentShader: SKY_FRAG });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
  sky.renderOrder = -1000; sky.frustumCulled = false; sky.userData.noAO = true; sky.userData.noShadow = true; sky.userData.keep = true;
  scene.add(sky);

  // cảnh nhỏ để nướng ánh sáng môi trường: bầu trời + mặt đất hắt sáng + "cửa sổ" sáng khi ở trong nhà
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(sky.geometry, new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    vertexShader: 'varying vec3 vDir;\nvoid main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4( position * 50.0, 1.0 ); }', fragmentShader: SKY_FRAG }));
  envScene.add(envSky);
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(60, 24), new THREE.MeshBasicMaterial({ color: '#b89a84', toneMapped: false })); envGround.rotation.x = -Math.PI / 2; envGround.position.y = -1.5; envScene.add(envGround);
  const envRoom = new THREE.Group(); envScene.add(envRoom);
  { // phòng: trần và tường hắt màu ấm, một ô cửa sổ sáng mạnh phía sau-phải (đúng hướng cửa sổ trong game)
    const wallM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.27, 0.28), side: THREE.BackSide, toneMapped: false });
    const box = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 22), wallM); box.position.y = 4; envRoom.add(box);
    const winM = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.7, 4.2), toneMapped: false });
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), winM); w1.position.set(3, 4, -10.9); envRoom.add(w1);
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(9, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.25, 1.4), toneMapped: false })); w2.position.set(10.9, 5, 2); w2.rotation.y = -Math.PI / 2; envRoom.add(w2);
    envRoom.userData.win = winM;
  }
  let envRT = null, envKey = '';
  function bakeEnv() {
    const old = envRT; envRT = pmrem.fromScene(envScene, 0.02, 0.1, 200);
    scene.environment = envRT.texture; if (old) old.dispose();
  }

  /** Cập nhật bầu trời, ánh sáng môi trường theo buổi / thời tiết / trong nhà hay ngoài trời. */
  function setLook({ top, horizon, night, sky: wx, indoor, bedroom }) {
    skyU.uTop.value.set(top); skyU.uHorizon.value.set(horizon);
    skyU.uNight.value = night ? 1 : 0; skyU.uGray.value = wx === 'rain' ? 0.75 : wx === 'cloudy' ? 0.45 : 0; skyU.uCloud.value = wx === 'rain' ? 1 : wx === 'cloudy' ? 0.85 : night ? 0.25 : 0.45;
    skyU.uSunCol.value.set(night ? '#cdd6ff' : '#fff0cf');
    skyU.uSunDir.value.set(0.34, night ? 0.62 : 0.74, 0.58).normalize();
    envRoom.visible = !!indoor; envGround.visible = !indoor;
    envRoom.userData.win.color.setRGB(night ? 0.35 : 5, night ? 0.4 : 4.7, night ? 0.7 : 4.2);
    envGround.material.color.set(night ? '#2a2c4a' : '#9fb48a');
    const key = [top, horizon, night, wx, indoor, bedroom].join('|');
    if (key !== envKey) { envKey = key; bakeEnv(); }
    scene.environmentIntensity = bedroom ? 0.3 : indoor ? (night ? 0.3 : 0.7) : (night ? 0.35 : 0.5);
    look.indoor = !!indoor; look.night = !!night;
  }
  const look = { indoor: true, night: false };

  /* ---------- hậu kỳ ---------- */
  renderer.setClearColor(0x000000, 1);
  const size = new THREE.Vector2(); renderer.getDrawingBufferSize(size);
  const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
  const gtao = new GTAOPass(scene, camera, size.x, size.y);
  gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1.2, rings: 2, samples: 12 });
  gtao.blendIntensity = 0.9;
  // Lượt vẽ pháp tuyến/độ sâu của GTAO dùng một vật liệu chung cho mọi thứ: ẩn vật trong suốt, sprite, lớp lông, bầu trời
  const hidden = [];
  gtao._overrideVisibility = function () {
    scene.traverse(o => {
      if (!o.visible) return;
      const m = o.material;
      if (o.isPoints || o.isLine || o.isSprite || o.userData.noAO || (o.isMesh && m && (m.transparent || m.depthWrite === false || m.blending === THREE.AdditiveBlending))) { o.visible = false; hidden.push(o); }
    });
  };
  gtao._restoreVisibility = function () { for (const o of hidden) o.visible = true; hidden.length = 0; };
  composer.addPass(gtao);

  // độ sâu trường ảnh: lấy nét vào bé, xa và rất gần thì mờ dần (kiểu ống kính tele chụp cận cảnh đồ chơi)
  const dof = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 100 }, uFocus: { value: 9 }, uRange: { value: 7 }, uSafe: { value: 1.6 }, uMax: { value: 5 }, uTexel: { value: new THREE.Vector2(1 / size.x, 1 / size.y) } },
    vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
    fragmentShader: `
      uniform sampler2D tDiffuse, tDepth; uniform float uNear, uFar, uFocus, uRange, uSafe, uMax; uniform vec2 uTexel; varying vec2 vUv;
      float lin( float d ) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / ( uFar + uNear - z * ( uFar - uNear ) ); }
      float coc( vec2 uv ) { float z = lin( texture2D( tDepth, uv ).x ); return clamp( ( abs( z - uFocus ) - uSafe ) / uRange, 0.0, 1.0 ); }
      void main() {
        float c0 = coc( vUv );
        vec4 base = texture2D( tDiffuse, vUv );
        if ( c0 < 0.02 ) { gl_FragColor = base; return; }
        vec3 acc = base.rgb; float w = 1.0;
        const float GA = 2.39996323;
        for ( int i = 1; i <= 28; i++ ) {
          float fi = float( i ), r = sqrt( fi / 28.0 ) * c0 * uMax;
          vec2 uv = vUv + vec2( cos( fi * GA ), sin( fi * GA ) ) * r * uTexel;
          float cs = coc( uv );
          float ww = smoothstep( 0.0, 0.25, cs ) + 0.05;
          vec3 s = texture2D( tDiffuse, uv ).rgb;
          ww *= 1.0 + max( max( s.r, s.g ), s.b ) * 0.6;
          acc += s * ww; w += ww;
        }
        gl_FragColor = vec4( acc / w, base.a );
      }`,
  });
  dof.uniforms.tDepth.value = gtao.depthTexture; // ShaderPass sao chép uniform nên phải gán lại hoạ tiết độ sâu thật
  composer.addPass(dof);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.55, 1.0);
  composer.addPass(bloom);
  renderer.toneMappingExposure = 1.0;
  const output = new OutputPass(); composer.addPass(output);
  // chỉnh màu sau cùng (đã ở không gian sRGB): tương phản mềm, bão hoà, bóng lạnh / sáng ấm, vignette, quang sai rìa, hạt phim
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.3 }, uGrain: { value: 0.022 }, uSat: { value: 1.14 }, uCon: { value: 1.1 }, uWarm: { value: 0.03 } },
    vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uSat, uCon, uWarm; varying vec2 vUv;
      void main() {
        vec2 c = vUv - 0.5; float r2 = dot( c, c );
        vec2 off = c * r2 * 0.004;
        vec3 col = vec3( texture2D( tDiffuse, vUv + off ).r, texture2D( tDiffuse, vUv ).g, texture2D( tDiffuse, vUv - off ).b );
        float l = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
        col = mix( vec3( l ), col, uSat );
        col = ( col - 0.5 ) * uCon + 0.5;
        col += vec3( uWarm, uWarm * 0.3, -uWarm ) * smoothstep( 0.35, 1.0, l ) + vec3( -uWarm * 0.6, 0.0, uWarm ) * ( 1.0 - smoothstep( 0.0, 0.4, l ) );
        col *= 1.0 - uVig * smoothstep( 0.12, 0.62, r2 );
        float n = fract( sin( dot( vUv * vec2( 1920.0, 1080.0 ) + uTime * 61.0, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) - 0.5;
        col += n * uGrain;
        gl_FragColor = vec4( clamp( col, 0.0, 1.0 ), 1.0 );
      }`,
  });
  composer.addPass(grade);
  renderer.toneMapping = THREE.NeutralToneMapping; // OutputPass đọc kiểu tone mapping từ renderer; vẽ vào render target thì chưa áp

  function setSize(w, h, pr) {
    composer.setPixelRatio(pr); composer.setSize(w, h);
    dof.uniforms.uTexel.value.set(1 / (w * pr), 1 / (h * pr));
  }
  /* tự hạ bớt hiệu ứng khi máy không kham nổi (đo FPS trung bình mỗi 4 giây) */
  let fpsN = 0, fpsT = 0, level = 0;
  function adapt(dt) {
    fpsN++; fpsT += dt; if (fpsT < 4) return;
    const fps = fpsN / fpsT; fpsN = 0; fpsT = 0;
    if (document.hidden || fps > 26 || level >= 3) return;
    level++;
    if (level === 1) dof.enabled = false; else if (level === 2) gtao.enabled = false; else bloom.enabled = false;
  }
  const v3 = new THREE.Vector3();
  /** Vẽ một khung hình. `focus`: điểm lấy nét (toạ độ thế giới). */
  function render(dt, t, focus, allowAdapt = true) {
    sky.position.copy(camera.position); sky.scale.setScalar(camera.far * 0.9); sky.updateMatrixWorld();
    skyU.uTime.value = t; furTime.value = t; grade.uniforms.uTime.value = t % 100;
    if (focus) { const d = v3.copy(focus).sub(camera.position).length(); const u = dof.uniforms; u.uFocus.value += (d - u.uFocus.value) * Math.min(1, dt * 4); u.uNear.value = camera.near; u.uFar.value = camera.far;
      u.uSafe.value = look.indoor ? 1.5 : 3.2; u.uRange.value = look.indoor ? 7 : 16; u.uMax.value = look.indoor ? 5 : 3.2; }
    composer.render(dt);
    if (allowAdapt) adapt(dt);
  }
  return { mat, petMat, addFur, setLook, setSize, render, composer, sky, passes: { gtao, dof, bloom, grade } };
}
