import { Highlight, Bookmark, TOCItem, GoalHighlightResult, MergedConnection, DocumentVersionComparison, QuestionTOCItem, ClaimVerification } from '../types';

export interface UserStats {
  topicSpeeds: Record<string, { wordsRead: number; timeSpentMs: number }>;
}

export interface SavedDocument {
  id: string;
  name: string;
  type: string;
  pages: string[];
  createdAt: number;
  lastOpenedAt?: number;
  lastReadPage?: number;
  highlights?: Highlight[];
  bookmarks?: Bookmark[];
  toc?: TOCItem[];
  goal?: string;
  goalHighlights?: GoalHighlightResult[];
  
  abandonedReason?: string;
  condensedSummary?: string;
  isDebtAnalyzed?: boolean;
  
  mergedSummary?: string;
  mergedConnections?: MergedConnection[];
  
  versionComparison?: DocumentVersionComparison;

  topic?: string;
  questionToc?: QuestionTOCItem[];
  claimVerifications?: ClaimVerification[];
}

const DB_NAME = 'MyReaderDB';
const DB_VERSION = 3;
const STORE_NAME = 'documents';
const STATS_KEY = 'MyReaderUserStats';

export const getUserStats = (): UserStats => {
  const statsStr = localStorage.getItem(STATS_KEY);
  if (statsStr) {
    try {
      return JSON.parse(statsStr);
    } catch (e) {
      console.error('Failed to parse user stats', e);
    }
  }
  return { topicSpeeds: {} };
};

export const saveUserStats = (stats: UserStats): void => {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
};

export const updateReadingSpeed = (topic: string, words: number, timeMs: number): void => {
  if (!topic) return;
  const stats = getUserStats();
  if (!stats.topicSpeeds[topic]) {
    stats.topicSpeeds[topic] = { wordsRead: 0, timeSpentMs: 0 };
  }
  stats.topicSpeeds[topic].wordsRead += words;
  stats.topicSpeeds[topic].timeSpentMs += timeMs;
  saveUserStats(stats);
};

export const getSlowTopics = (): string[] => {
  const stats = getUserStats();
  const speeds = Object.entries(stats.topicSpeeds).map(([topic, data]) => {
    const wpm = data.timeSpentMs > 0 ? (data.wordsRead / data.timeSpentMs) * 60000 : 0;
    return { topic, wpm };
  }).filter(t => t.wpm > 0);
  
  if (speeds.length === 0) return [];
  speeds.sort((a, b) => a.wpm - b.wpm);
  return speeds.slice(0, 3).map(s => s.topic);
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveDocument = async (doc: SavedDocument): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(doc);
    
    transaction.oncomplete = () => {
        db.close();
        resolve();
    };
    
    transaction.onerror = () => {
        db.close();
        reject(transaction.error);
    };
  });
};

export const getDocuments = async (): Promise<SavedDocument[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    let docs: SavedDocument[] = [];
    request.onsuccess = () => {
        docs = request.result || [];
    };
    
    transaction.oncomplete = () => {
        db.close();
        resolve(docs.sort((a, b) => b.createdAt - a.createdAt));
    };
    
    transaction.onerror = () => {
        db.close();
        reject(transaction.error);
    };
  });
};

export const deleteDocument = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);
    
    transaction.oncomplete = () => {
        db.close();
        resolve();
    };
    
    transaction.onerror = () => {
        console.error("Transaction failed", transaction.error);
        db.close();
        reject(transaction.error);
    };
  });
};
