/**
 * Service Worker для ВИК Контроль
 * Кэширование, офлайн-работа, background sync
 */

const CACHE_NAME = 'vik-control-v1';
const STATIC_CACHE = 'vik-static-v1';
const API_CACHE = 'vik-api-v1';

// Статические ресурсы для кэширования
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/api.js',
    '/js/offline.js',
    '/js/app.js',
    '/manifest.json',
];

// Установка - кэшируем статику
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Активация - очистка старых кэшей
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== STATIC_CACHE && name !== API_CACHE)
                    .map(name => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // API запросы - Network First с fallback
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleAPIRequest(request));
        return;
    }
    
    // Статика - Cache First
    if (request.method === 'GET') {
        event.respondWith(handleStaticRequest(request));
    }
});

async function handleStaticRequest(request) {
    const cache = await caches.open(STATIC_CACHE);
    
    // Пробуем взять из кэша
    const cached = await cache.match(request);
    if (cached) {
        // Обновляем кэш в фоне
        fetch(request).then(response => {
            if (response.ok) {
                cache.put(request, response.clone());
            }
        }).catch(() => {});
        
        return cached;
    }
    
    // Если нет в кэше - загружаем
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        // Fallback для навигации
        if (request.mode === 'navigate') {
            return cache.match('/index.html');
        }
        throw err;
    }
}

async function handleAPIRequest(request) {
    // Для GET - пробуем сеть, затем кэш
    if (request.method === 'GET') {
        try {
            const networkResponse = await fetch(request);
            
            if (networkResponse.ok) {
                // Кэшируем успешный ответ
                const cache = await caches.open(API_CACHE);
                cache.put(request, networkResponse.clone());
            }
            
            return networkResponse;
        } catch (err) {
            // Офлайн - пробуем взять из кэша
            const cache = await caches.open(API_CACHE);
            const cached = await cache.match(request);
            
            if (cached) {
                // Добавляем заголовок, чтобы клиент знал что это кэш
                const headers = new Headers(cached.headers);
                headers.set('X-SW-Cached', 'true');
                
                return new Response(cached.body, {
                    status: 200,
                    statusText: 'OK (cached)',
                    headers,
                });
            }
            
            // Нет в кэше
            return new Response(
                JSON.stringify({ error: 'Офлайн режим. Данные недоступны.' }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
        }
    }
    
    // Для POST/PUT/DELETE - проксируем
    try {
        return await fetch(request);
    } catch (err) {
        // В офлайн - сохраняем для background sync
        if ('sync' in self.registration) {
            await saveForSync(request);
        }
        
        throw err;
    }
}

// Background Sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-records') {
        event.waitUntil(syncRecords());
    }
});

async function saveForSync(request) {
    // Сохраняем запрос для последующей синхронизации
    const db = await openDB();
    const body = await request.clone().text();
    
    await db.add('syncQueue', {
        url: request.url,
        method: request.method,
        headers: Array.from(request.headers.entries()),
        body,
        timestamp: Date.now(),
    });
}

async function syncRecords() {
    const db = await openDB();
    const tx = db.transaction('syncQueue', 'readonly');
    const store = tx.objectStore('syncQueue');
    const requests = await store.getAll();
    
    for (const req of requests) {
        try {
            const headers = new Headers(req.headers);
            const response = await fetch(req.url, {
                method: req.method,
                headers,
                body: req.body,
            });
            
            if (response.ok) {
                // Удаляем из очереди
                const deleteTx = db.transaction('syncQueue', 'readwrite');
                await deleteTx.objectStore('syncQueue').delete(req.id);
            }
        } catch (err) {
            console.error('[SW] Sync failed for request:', req.id);
        }
    }
    
    // Уведомляем клиентов
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_COMPLETE' });
    });
}

// IndexedDB helper
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('vik-control-v1', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('syncQueue')) {
                db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// Push notifications (заготовка для будущего)
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'ВИК Контроль', {
            body: data.body || 'Новое уведомление',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            data: data.data || {},
        })
    );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        self.clients.openWindow('/')
    );
});
