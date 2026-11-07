import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { makeFireflies, makeWorld } from './world.js';

const toon = (color: string) => new THREE.MeshBasicMaterial({ color });
function setup(quality = 'vua') {
  const g = new THREE.Group(), shadowed: unknown[] = [];
  const c = { THREE, toon, quality: () => quality, applyShadows: (o: unknown) => shadowed.push(o) };
  return { g, c, shadowed, world: makeWorld(c, g) };
}
const box = () => new THREE.BoxGeometry(1, 1, 1);

describe('world.js: khu dựng dần theo vị trí bé', () => {
  it('khu lõi dựng ngay; khu khác chỉ dựng khi bé tới gần, rồi ẩn khi bé đi xa', () => {
    const { world, g } = setup(); let builtFar = 0, builtNear = 0;
    world.zone({ id: 'core', core: true, cx: 0, cz: 0, build: (z: THREE.Group) => { z.add(new THREE.Mesh(box())); } });
    world.zone({ id: 'near', cx: 10, cz: 0, show: 8, build: (z: THREE.Group) => { builtNear++; z.add(new THREE.Mesh(box())); } });
    world.zone({ id: 'far', cx: 40, cz: 0, show: 8, build: () => { builtFar++; return [() => {}]; } });
    expect(world.status().map((s: { id: string; state: string }) => s.state)).toEqual(['ready', 'idle', 'idle']);
    world.update(0, 0); expect(builtNear).toBe(0); expect(builtFar).toBe(0); // chưa tới gần
    world.update(6, 0); world.update(6, 0); // tới gần khu 'near' (cách 4 < 8): dựng xong sau vài khung
    expect(builtNear).toBe(1); expect(builtFar).toBe(0);
    expect(world.status().find((s: { id: string }) => s.id === 'near')).toMatchObject({ state: 'ready', visible: true });
    world.update(-20, 0); expect(world.status().find((s: { id: string }) => s.id === 'near')?.visible).toBe(false); // đi xa thì ẩn, không dựng lại
    expect(builtNear).toBe(1); expect(g.children).toHaveLength(3);
  });
  it('việc dựng chia nhỏ: mỗi khung hình chạy trong ngân sách thời gian, xong hết mới đánh dấu ready và áp bóng đổ', () => {
    const { world, shadowed } = setup(); let done = 0;
    world.zone({ id: 'big', cx: 0, cz: 0, show: 50, build: () => Array.from({ length: 400 }, () => () => { const t = performance.now(); while (performance.now() - t < 0.05) { /* việc nhỏ */ } done++; }) });
    world.update(0, 0); expect(done).toBeGreaterThan(0); expect(done).toBeLessThan(400); // không dựng hết trong một khung
    expect(world.status()[0].state).toBe('building');
    for (let i = 0; i < 200 && world.status()[0].state !== 'ready'; i++) world.update(0, 0);
    expect(done).toBe(400); expect(world.status()[0].state).toBe('ready'); expect(shadowed).toHaveLength(1);
  });
  it('finishAll dựng mọi khu ngay (dùng khi kiểm thử)', () => {
    const { world } = setup(); let n = 0;
    ['a', 'b', 'c'].forEach((id, i) => world.zone({ id, cx: i * 100, cz: 0, show: 5, build: () => { n++; return [() => {}, () => {}]; } }));
    world.finishAll(); expect(n).toBe(3); expect(world.status().every((s: { state: string }) => s.state === 'ready')).toBe(true);
  });
});

describe('world.js: scatter (InstancedMesh) và mật độ', () => {
  it('một InstancedMesh cho cả loạt, kèm viền; không viền khi outline = null; mảng rỗng thì không tạo gì', () => {
    const { world, g } = setup();
    const m = world.scatter(g, box(), world.toonC('#fff'), [{ x: 0, z: 0 }, { x: 1, z: 1, s: 2 }, { x: 2, z: 2, color: '#ff0000' }], '#000');
    expect(m.isInstancedMesh).toBe(true); expect(m.count).toBe(3); expect(g.children.filter((o: THREE.Object3D) => o.userData.outline)).toHaveLength(1);
    const before = g.children.length; world.scatter(g, box(), world.toonC('#fff'), [{ x: 0, z: 0 }], null as unknown as string); expect(g.children.length - before).toBe(1);
    expect(world.scatter(g, box(), world.toonC('#fff'), [])).toBeNull();
  });
  it('cache dùng chung hình/vật liệu; mật độ giảm một nửa ở chất lượng Thấp', () => {
    const { world } = setup(); let n = 0; const a = world.geo('k', () => { n++; return box(); }), b = world.geo('k', () => { n++; return box(); });
    expect(a).toBe(b); expect(n).toBe(1); expect(world.toonC('#fff')).toBe(world.toonC('#fff'));
    expect(world.density()).toBe(1); expect(setup('thap').world.density()).toBe(0.5);
  });
  it('đom đóm chỉ hiện ban đêm', () => {
    const g = new THREE.Group(), update = makeFireflies(THREE, g, { x0: -5, x1: 5, z0: -5, z1: 5 }, 8), m = g.children[0] as THREE.InstancedMesh;
    update(1, false); expect(m.visible).toBe(false); update(1, true); expect(m.visible).toBe(true); expect(m.count).toBe(8);
  });
});
