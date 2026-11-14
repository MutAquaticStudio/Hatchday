/** Album ảnh lưu ngay trong trình duyệt (IndexedDB): ảnh chụp ở chế độ Chụp ảnh tự vào album, tối đa 40 ảnh (ảnh cũ nhất bị thay). */
export interface AlbumPhoto { id: number; at: number; place: string; blob: Blob }
const DB = 'hatchday-album', STORE = 'photos', MAX = 40;

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction(STORE, mode), r = fn(t.objectStore(STORE)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
};

export async function listPhotos(): Promise<AlbumPhoto[]> {
  try { return ((await tx('readonly', s => s.getAll())) as AlbumPhoto[]).sort((a, b) => b.at - a.at); } catch { return []; }
}
export async function addPhoto(blob: Blob, place: string): Promise<boolean> {
  try {
    const all = await listPhotos();
    for (const old of all.slice(MAX - 1)) await tx('readwrite', s => s.delete(old.id));
    await tx('readwrite', s => s.add({ at: Date.now(), place, blob }));
    return true;
  } catch { return false; }
}
export async function deletePhoto(id: number): Promise<void> { try { await tx('readwrite', s => s.delete(id)); } catch { /* bỏ qua */ } }
export const ALBUM_MAX = MAX;
