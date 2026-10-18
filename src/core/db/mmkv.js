import Constants from 'expo-constants';

let storage;
let isMMKVAvailable = false;

const isExpoGo = Constants.executionEnvironment === 'storeClient';

try {
  if (isExpoGo) {
    // Force fallback in Expo Go client because native MMKV C++ JSI code is not compiled in standard Expo Go
    throw new Error('MMKV not supported inside Expo Go environment.');
  }
  
  // Dynamically load MMKV to prevent crashes during import in environments where it is not available
  const { MMKV } = require('react-native-mmkv');
  storage = new MMKV({ id: 'lifeos-storage' });
  isMMKVAvailable = true;
  console.log('[StagHaus DB] MMKV initialized successfully.');
} catch (e) {
  if (isExpoGo) {
    console.log('[StagHaus DB] Running in Expo Go client. Activating in-memory storage fallback.');
  } else {
    console.warn('[StagHaus DB] MMKV is not available. Falling back to in-memory shim:', e.message);
  }
  
  const memoryStore = new Map();
  storage = {
    set: (key, value) => {
      if (typeof value === 'boolean') {
        memoryStore.set(key, value ? 'true' : 'false');
      } else if (typeof value === 'number') {
        memoryStore.set(key, String(value));
      } else {
        memoryStore.set(key, value);
      }
    },
    getString: (key) => {
      const val = memoryStore.get(key);
      return typeof val === 'string' ? val : undefined;
    },
    getNumber: (key) => {
      const val = memoryStore.get(key);
      return val ? Number(val) : undefined;
    },
    getBoolean: (key) => {
      const val = memoryStore.get(key);
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    },
    delete: (key) => {
      memoryStore.delete(key);
    },
    clearAll: () => {
      memoryStore.clear();
    },
    getAllKeys: () => {
      return Array.from(memoryStore.keys());
    },
  };
}

// Zustand-compatible storage interface
export const zustandStorage = {
  setItem: (name, value) => {
    try {
      storage.set(name, value);
    } catch (e) {
      console.error('[StagHaus Storage] Failed to set item in storage:', e);
    }
  },
  getItem: (name) => {
    try {
      const value = storage.getString(name);
      return value ?? null;
    } catch (e) {
      console.error('[StagHaus Storage] Failed to get item from storage:', e);
      return null;
    }
  },
  removeItem: (name) => {
    try {
      storage.delete(name);
    } catch (e) {
      console.error('[StagHaus Storage] Failed to remove item from storage:', e);
    }
  },
};

export { isMMKVAvailable };
export default storage;
