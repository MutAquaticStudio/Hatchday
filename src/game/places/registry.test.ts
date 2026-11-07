import { describe, expect, it } from 'vitest';
import { BLOCK_TEXT, enterBlock, MAP_NODES as ALL_NODES, PLACE_BY_ID, PLACES, SPACES } from './registry';

const MAP_NODES = ALL_NODES.filter(n => !n.hidden); // ghim thật trên Bản đồ (không tính không gian của nhà)

describe('địa điểm', () => {
  it('7 địa điểm trên Bản đồ + 3 không gian của nhà, id duy nhất, ghim nằm trong khung và không đè nhau', () => {
    expect(PLACES).toHaveLength(10); expect(PLACES.filter(p => !p.hidden)).toHaveLength(7); expect(SPACES.map(p => p.id)).toEqual(['balcony', 'playroom', 'rooftop']);
    expect(new Set(PLACES.map(p => p.id)).size).toBe(10);
    expect(MAP_NODES).toHaveLength(9);
    for (const n of MAP_NODES) { expect(n.map.x).toBeGreaterThanOrEqual(8); expect(n.map.x).toBeLessThanOrEqual(92); expect(n.map.y).toBeGreaterThanOrEqual(6); expect(n.map.y).toBeLessThanOrEqual(94); }
    for (let i = 0; i < MAP_NODES.length; i++) for (let j = i + 1; j < MAP_NODES.length; j++) {
      const a = MAP_NODES[i].map, b = MAP_NODES[j].map; expect(Math.hypot(a.x - b.x, (a.y - b.y) * 0.7), `${MAP_NODES[i].id}/${MAP_NODES[j].id}`).toBeGreaterThan(18);
    }
  });
  it('vùng đi được hợp lệ và thú đứng trong vùng đó', () => {
    for (const p of PLACES) {
      expect(p.walk.x[0]).toBeLessThan(p.walk.x[1]); expect(p.walk.z[0]).toBeLessThan(p.walk.z[1]);
      expect(p.pet[0]).toBeGreaterThanOrEqual(p.walk.x[0]); expect(p.pet[0]).toBeLessThanOrEqual(p.walk.x[1]);
      expect(p.pet[2]).toBeGreaterThanOrEqual(p.walk.z[0]); expect(p.pet[2]).toBeLessThanOrEqual(p.walk.z[1]);
      expect(p.ctx.some(([k]) => k === (p.hidden ? 'home' : 'map'))).toBe(true);
    }
  });
  it('không gian của nhà mở theo cấp Gắn bó 3, 5, 7', () => {
    expect(SPACES.map(p => p.unlock)).toEqual([3, 5, 7]);
    expect(enterBlock('balcony', { bondLevel: 2, asleep: false })).toBe('locked'); expect(enterBlock('balcony', { bondLevel: 3, asleep: false })).toBeNull();
    expect(enterBlock('playroom', { bondLevel: 4, asleep: false })).toBe('locked'); expect(enterBlock('rooftop', { bondLevel: 7, asleep: false })).toBeNull();
    expect(enterBlock('rooftop', { bondLevel: 9, asleep: true })).toBe('asleep');
  });
  it('Bệnh viện luôn mở, kể cả đang ngủ; nơi khác thì chặn khi ngủ', () => {
    expect(PLACE_BY_ID.hospital.unlock).toBe(0);
    expect(enterBlock('hospital', { bondLevel: 1, asleep: true })).toBeNull();
    expect(enterBlock('tailor', { bondLevel: 1, asleep: true })).toBe('asleep');
    expect(enterBlock('home', { bondLevel: 1, asleep: true })).toBeNull();
  });
  it('khoá theo Gắn bó: Chợ và Thư viện cấp 2; nơi chung theo cấp riêng; nơi không có báo "sắp mở"', () => {
    expect(enterBlock('market', { bondLevel: 1, asleep: false })).toBe('locked');
    expect(enterBlock('market', { bondLevel: 2, asleep: false })).toBeNull();
    expect(enterBlock('library', { bondLevel: 2, asleep: false })).toBeNull();
    expect(enterBlock('plaza', { bondLevel: 1, asleep: false })).toBe('locked');
    expect(enterBlock('plaza', { bondLevel: 2, asleep: false })).toBeNull();
    expect(enterBlock('tea', { bondLevel: 2, asleep: false })).toBe('locked');
    expect(enterBlock('park', { bondLevel: 4, asleep: false })).toBeNull();
    expect(enterBlock('nowhere', { bondLevel: 10, asleep: false })).toBe('soon');
    expect(BLOCK_TEXT.locked(MAP_NODES.find(n => n.id === 'market'))).toContain('cấp 2');
  });
});
