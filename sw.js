const CACHE_NAME = 'comunidad-renca-v2';
const isDevelopment = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// Install event - skip waiting immediately
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing... (v2)');
  self.skipWaiting();
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network first for development, cache for production
self.addEventListener('fetch', (event) => {
  // Skip caching during development
  if (isDevelopment) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Production: Network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses
        if (response && response.status === 200) {
          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('/index.html');
        });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  if (event.tag === 'sync-data' || event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});

/**
 * Sincroniza la cola offline cuando se restaura la conexión
 * Usa IndexedDB directamente desde el Service Worker
 */
async function syncOfflineQueue() {
  console.log('[Service Worker] Syncing offline queue...');

  try {
    // Abrir IndexedDB
    const db = await openIndexedDB();
    const requests = await getPendingRequests(db);

    if (requests.length === 0) {
      console.log('[Service Worker] No pending requests to sync');
      return;
    }

    console.log(`[Service Worker] Found ${requests.length} pending requests`);

    // Procesar cada solicitud pendiente
    for (const request of requests) {
      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          credentials: 'include'
        });

        if (response.ok) {
          // Marcar como completado
          await updateRequestStatus(db, request.id, 'completed');
          console.log('[Service Worker] Request synced:', request.id);

          // Notificar a los clientes
          await notifyClients({
            type: 'SYNC_COMPLETED',
            requestId: request.id,
            success: true
          });
        } else {
          // Incrementar intentos y marcar como fallido si excede el límite
          const attempts = (request.attempts || 0) + 1;
          if (attempts >= 3) {
            await updateRequestStatus(db, request.id, 'failed', { attempts, error: response.statusText });
            await notifyClients({
              type: 'SYNC_FAILED',
              requestId: request.id,
              error: response.statusText
            });
          } else {
            await updateRequestStatus(db, request.id, 'pending', { attempts });
          }
        }
      } catch (error) {
        console.error('[Service Worker] Error syncing request:', request.id, error);
        const attempts = (request.attempts || 0) + 1;
        if (attempts >= 3) {
          await updateRequestStatus(db, request.id, 'failed', { attempts, error: error.message });
        } else {
          await updateRequestStatus(db, request.id, 'pending', { attempts });
        }
      }
    }

    // Notificar que la sincronización terminó
    await notifyClients({ type: 'SYNC_COMPLETE' });
    console.log('[Service Worker] Offline queue sync completed');
  } catch (error) {
    console.error('[Service Worker] Error in syncOfflineQueue:', error);
  }
}

// Helper: Abrir IndexedDB
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ComunidadRencaDB', 3);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Helper: Obtener peticiones pendientes
function getPendingRequests(db) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(['offline_queue'], 'readonly');
      const store = transaction.objectStore('offline_queue');
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (error) {
      // Store might not exist
      resolve([]);
    }
  });
}

// Helper: Actualizar estado de petición
function updateRequestStatus(db, id, status, extra = {}) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline_queue'], 'readwrite');
    const store = transaction.objectStore('offline_queue');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const data = getReq.result;
      if (!data) {
        resolve();
        return;
      }

      const updated = {
        ...data,
        status,
        ...extra,
        lastUpdated: new Date().toISOString()
      };

      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

// Helper: Notificar a todos los clientes
async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(client => {
    client.postMessage(message);
  });
}

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received');

  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Ver',
        icon: '/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/icons/icon-72x72.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Comunidad Renca', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event.action);
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
