
// IndexedDB Service for persisting trading state
const DB_NAME = 'GeminiTraderDB';
const DB_VERSION = 4; // Incremented for settings store
const STORE_PORTFOLIO = 'portfolio';
const STORE_LOGS = 'logs';
const STORE_REPORTS = 'reports';
const STORE_SETTINGS = 'settings';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject("Database error: " + (event.target as IDBOpenDBRequest).error);

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      const storeNames = [STORE_PORTFOLIO, STORE_LOGS, STORE_REPORTS, STORE_SETTINGS];
      
      // Create stores if they don't exist
      if (!db.objectStoreNames.contains(STORE_PORTFOLIO)) db.createObjectStore(STORE_PORTFOLIO, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_LOGS)) db.createObjectStore(STORE_LOGS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_REPORTS)) db.createObjectStore(STORE_REPORTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
    };
  });
};

export const saveToDB = async (storeName: string, data: any) => {
  try {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      if (Array.isArray(data)) {
        console.warn(`Attempted to save array to ${storeName}. Skipping.`);
        resolve(); 
        return;
      }

      if (!data.id && store.keyPath === 'id') {
          // Auto-assign ID 'config' for single settings object
          if (storeName === 'settings') data.id = 'config';
          else console.warn(`Attempted to save to ${storeName} without an ID.`);
      }

      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error(`IDB Error saving to ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  } catch (e) {
    console.error("DB Connection Error:", e);
  }
};

export const loadFromDB = async (storeName: string, key?: any) => {
  try {
    const db = await initDB();
    return new Promise<any>((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = key ? store.get(key) : store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("DB Load Error:", e);
    return null;
  }
};

export const clearDB = async () => {
  const db = await initDB();
  const stores = [STORE_PORTFOLIO, STORE_LOGS, STORE_REPORTS, STORE_SETTINGS];
  stores.forEach(name => {
    if (db.objectStoreNames.contains(name)) {
      const transaction = db.transaction([name], 'readwrite');
      transaction.objectStore(name).clear();
    }
  });
};
