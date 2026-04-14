/**
 * Офлайн-функциональность для PWA
 * IndexedDB + Background Sync
 */

// ===== IndexedDB =====
const DB_NAME = 'vik-control-v1';
const DB_VERSION = 1;

class OfflineDB {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Очередь синхронизации
                if (!db.objectStoreNames.contains('syncQueue')) {
                    const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                    syncStore.createIndex('synced', 'synced', { unique: false });
                }
                
                // Кэш записей для офлайн-чтения
                if (!db.objectStoreNames.contains('recordsCache')) {
                    db.createObjectStore('recordsCache', { keyPath: 'id' });
                }
                
                // Справочники
                if (!db.objectStoreNames.contains('dictionaries')) {
                    db.createObjectStore('dictionaries', { keyPath: 'type' });
                }
            };
        });
    }

    // Sync Queue
    async addToQueue(action) {
        const transaction = this.db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        
        return store.add({
            ...action,
            timestamp: Date.now(),
            synced: false,
            retries: 0,
        });
    }

    async getQueue() {
        const transaction = this.db.transaction(['syncQueue'], 'readonly');
        const store = transaction.objectStore('syncQueue');
        const index = store.index('synced');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(0);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async markAsSynced(id) {
        const transaction = this.db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        
        const request = store.get(id);
        request.onsuccess = () => {
            const data = request.result;
            data.synced = true;
            store.put(data);
        };
    }

    async removeFromQueue(id) {
        const transaction = this.db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        return store.delete(id);
    }

    async clearQueue() {
        const transaction = this.db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        return store.clear();
    }

    // Records Cache
    async cacheRecords(records) {
        const transaction = this.db.transaction(['recordsCache'], 'readwrite');
        const store = transaction.objectStore('recordsCache');
        
        records.forEach(record => store.put(record));
    }

    async getCachedRecords() {
        const transaction = this.db.transaction(['recordsCache'], 'readonly');
        const store = transaction.objectStore('recordsCache');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Dictionaries Cache
    async cacheDictionary(type, data) {
        const transaction = this.db.transaction(['dictionaries'], 'readwrite');
        const store = transaction.objectStore('dictionaries');
        return store.put({ type, data, timestamp: Date.now() });
    }

    async getCachedDictionary(type) {
        const transaction = this.db.transaction(['dictionaries'], 'readonly');
        const store = transaction.objectStore('dictionaries');
        
        return new Promise((resolve, reject) => {
            const request = store.get(type);
            request.onsuccess = () => resolve(request.result?.data);
            request.onerror = () => reject(request.error);
        });
    }
}

// ===== Offline Queue Manager =====
class OfflineQueue {
    constructor() {
        this.db = new OfflineDB();
        this.initialized = false;
    }

    async init() {
        if (!this.initialized) {
            await this.db.init();
            this.initialized = true;
        }
    }

    async add(action) {
        await this.init();
        await this.db.addToQueue(action);
        
        // Регистрируем background sync если доступно
        if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-records');
        }
        
        showToast('Сохранено офлайн. Будет синхронизировано при подключении.', 'info');
    }

    async process() {
        await this.init();
        
        const queue = await this.db.getQueue();
        if (queue.length === 0) return;
        
        showSyncIndicator(true);
        
        for (const item of queue) {
            try {
                const headers = {
                    'Content-Type': 'application/json',
                };
                
                if (api.accessToken) {
                    headers['Authorization'] = `Bearer ${api.accessToken}`;
                }
                
                const response = await fetch(item.url, {
                    ...item.options,
                    headers,
                });
                
                if (response.ok) {
                    await this.db.markAsSynced(item.id);
                } else if (item.retries >= 3) {
                    // Удаляем после 3 неудачных попыток
                    await this.db.removeFromQueue(item.id);
                } else {
                    item.retries++;
                }
            } catch (err) {
                console.error('Sync error:', err);
                break; // Прерываем если нет соединения
            }
        }
        
        showSyncIndicator(false);
    }

    async clear() {
        await this.init();
        await this.db.clearQueue();
    }
}

// ===== UI Helpers =====
function showOfflineIndicator(show) {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
        indicator.classList.toggle('hidden', !show);
    }
}

function showSyncIndicator(show) {
    const indicator = document.getElementById('sync-indicator');
    if (indicator) {
        indicator.classList.toggle('hidden', !show);
    }
}

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ===== Network Events =====
window.addEventListener('online', () => {
    showOfflineIndicator(false);
    showToast('Подключение восстановлено', 'success');
    offlineQueue.process();
});

window.addEventListener('offline', () => {
    showOfflineIndicator(true);
    showToast('Офлайн режим', 'warning');
});

// ===== Init =====
const offlineQueue = new OfflineQueue();

// Проверяем состояние при загрузке
if (!navigator.onLine) {
    showOfflineIndicator(true);
}
