import { HistoryItem } from '../types';

export interface Persona {
  id: string;
  name: string;
  images: string[]; // Base64 strings
}

const DB_NAME = 'anexa_db';
const DB_VERSION = 1;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event);
      reject('Error opening IndexedDB');
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('history')) {
        db.createObjectStore('history', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('personas')) {
        db.createObjectStore('personas', { keyPath: 'id' });
      }
    };
  });
};

export const saveHistoryItemToDB = async (item: HistoryItem): Promise<void> => {
  try {
    const db = await initDB();
    const tx = db.transaction('history', 'readwrite');
    const store = tx.objectStore('history');
    store.put(item);
  } catch (error) {
    console.error('Failed to save to history DB', error);
  }
};

export const getHistoryFromDB = async (): Promise<HistoryItem[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('history', 'readonly');
      const store = tx.objectStore('history');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get history from DB', error);
    return [];
  }
};

export const clearHistoryDB = async (): Promise<void> => {
  try {
    const db = await initDB();
    const tx = db.transaction('history', 'readwrite');
    const store = tx.objectStore('history');
    store.clear();
  } catch (error) {
    console.error('Failed to clear history DB', error);
  }
};

export const savePersonaToDB = async (persona: Persona): Promise<void> => {
  try {
    const db = await initDB();
    const tx = db.transaction('personas', 'readwrite');
    const store = tx.objectStore('personas');
    store.put(persona);
  } catch (error) {
    console.error('Failed to save persona to DB', error);
  }
};

export const getPersonasFromDB = async (): Promise<Persona[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('personas', 'readonly');
      const store = tx.objectStore('personas');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get personas from DB', error);
    return [];
  }
};

export const deletePersonaFromDB = async (id: string): Promise<void> => {
  try {
    const db = await initDB();
    const tx = db.transaction('personas', 'readwrite');
    const store = tx.objectStore('personas');
    store.delete(id);
  } catch (error) {
    console.error('Failed to delete persona', error);
  }
};

export const clearPersonasDB = async (): Promise<void> => {
  try {
    const db = await initDB();
    const tx = db.transaction('personas', 'readwrite');
    const store = tx.objectStore('personas');
    store.clear();
  } catch (error) {
    console.error('Failed to clear personas DB', error);
  }
};
