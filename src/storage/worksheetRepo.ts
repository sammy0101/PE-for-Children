import type { InkCommand, WorksheetRecord } from '../domain/types';

const DB_NAME = 'ipad_worksheet_practice_db';
const DB_VERSION = 1;
const STORE_NAME = 'worksheets';

export interface WorksheetRepository {
  listWorksheets(): Promise<readonly WorksheetRecord[]>;
  getWorksheet(id: string): Promise<WorksheetRecord | null>;
  saveWorksheet(record: WorksheetRecord): Promise<void>;
  updateInkCommands(
    id: string,
    inkCommands: readonly InkCommand[],
    updatedAt?: number,
  ): Promise<WorksheetRecord | null>;
  deleteWorksheet(id: string): Promise<void>;
  importWorksheets(records: readonly WorksheetRecord[]): Promise<number>;
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('無法開啟本機資料庫'));
  });
}

function runTx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const req = executor(store);

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('資料庫讀寫失敗'));
  });
}

export function createWorksheetRepo(
  idbFactory: IDBFactory = globalThis.indexedDB,
): WorksheetRepository {
  let dbPromise: Promise<IDBDatabase> | null = null;

  const getDb = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
      dbPromise = openDatabase(idbFactory);
    }
    return dbPromise;
  };

  return {
    async listWorksheets(): Promise<readonly WorksheetRecord[]> {
      const db = await getDb();
      const rows = (await runTx(db, 'readonly', (store) => store.getAll())) as WorksheetRecord[];
      return [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async getWorksheet(id: string): Promise<WorksheetRecord | null> {
      const db = await getDb();
      const row = (await runTx(db, 'readonly', (store) => store.get(id))) as
        | WorksheetRecord
        | undefined;
      return row ?? null;
    },

    async saveWorksheet(record: WorksheetRecord): Promise<void> {
      const db = await getDb();
      await runTx(db, 'readwrite', (store) => store.put(record));
    },

    async updateInkCommands(
      id: string,
      inkCommands: readonly InkCommand[],
      updatedAt = Date.now(),
    ): Promise<WorksheetRecord | null> {
      const db = await getDb();
      const existing = (await runTx(db, 'readonly', (store) => store.get(id))) as
        | WorksheetRecord
        | undefined;
      if (!existing) return null;

      // 雙層隔離不變量：絕對不修改 baseImageDataUrl 與原始尺寸
      const updated: WorksheetRecord = {
        ...existing,
        inkCommands,
        updatedAt,
      };
      await runTx(db, 'readwrite', (store) => store.put(updated));
      return updated;
    },

    async deleteWorksheet(id: string): Promise<void> {
      const db = await getDb();
      await runTx(db, 'readwrite', (store) => store.delete(id));
    },

    async importWorksheets(records: readonly WorksheetRecord[]): Promise<number> {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const rec of records) {
          store.put(rec);
        }
        tx.oncomplete = () => resolve(records.length);
        tx.onerror = () => reject(tx.error ?? new Error('匯入資料失敗'));
      });
    },
  };
}
