/**
 * ELP Obras - Service Worker
 * Handles offline functionality, caching strategies, and background sync
 */

const CACHE_NAME = 'elp-obras-v1.2.0';
const STATIC_CACHE_NAME = 'elp-static-v1.2.0';
const DYNAMIC_CACHE_NAME = 'elp-dynamic-v1.2.0';

// Files to cache on install
const STATIC_FILES = [
    '/',
    '/login',
    '/dashboard',
    '/projects',
    '/reports',
    '/contacts',
    '/static/css/style.css',
    '/static/js/app.js',
    '/static/js/pwa.js',
    '/static/js/geolocation.js',
    '/static/manifest.json',
    // Bootstrap CSS and JS
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    // Font Awesome
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    // jsPDF
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Routes that should always go to network first
const NETWORK_FIRST_ROUTES = [
    '/api/',
    '/reports/create',
    '/projects/create',
    '/contacts/create',
    '/upload_photo/',
    '/logout'
];

// Routes for offline fallback
const OFFLINE_FALLBACK_PAGE = '/offline.html';

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        Promise.all([
            // Cache static files
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                console.log('Service Worker: Caching static files');
                return cache.addAll(STATIC_FILES.map(url => new Request(url, {
                    mode: 'no-cors'
                })));
            }),
            
            // Create offline page
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                return cache.put('/offline.html', new Response(`
                    <!DOCTYPE html>
                    <html lang="pt-BR">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Offline - ELP Obras</title>
                        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
                        <style>
                            body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
                            .offline-container { min-height: 100vh; display: flex; align-items: center; }
                            .offline-card { background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); border-radius: 20px; }
                        </style>
                    </head>
                    <body>
                        <div class="container offline-container">
                            <div class="row justify-content-center w-100">
                                <div class="col-md-6">
                                    <div class="card offline-card border-0 shadow-lg">
                                        <div class="card-body text-center p-5">
                                            <i class="fas fa-wifi text-muted fa-4x mb-3"></i>
                                            <h2 class="mb-3">Sem Conexão</h2>
                                            <p class="text-muted mb-4">
                                                Você está offline. Algumas funcionalidades podem estar limitadas.
                                            </p>
                                            <button class="btn btn-primary" onclick="window.history.back()">
                                                <i class="fas fa-arrow-left me-1"></i>Voltar
                                            </button>
                                            <button class="btn btn-outline-primary ms-2" onclick="window.location.reload()">
                                                <i class="fas fa-sync me-1"></i>Tentar Novamente
                                            </button>
                                            
                                            <hr class="my-4">
                                            
                                            <div class="row text-start">
                                                <div class="col-12">
                                                    <h6><i class="fas fa-info-circle me-2"></i>Funcionalidades Offline:</h6>
                                                    <ul class="list-unstyled small text-muted">
                                                        <li><i class="fas fa-check text-success me-2"></i>Visualizar páginas já visitadas</li>
                                                        <li><i class="fas fa-check text-success me-2"></i>Criar relatórios (serão sincronizados)</li>
                                                        <li><i class="fas fa-check text-success me-2"></i>Tirar fotos</li>
                                                        <li><i class="fas fa-times text-danger me-2"></i>Enviar relatórios por email</li>
                                                        <li><i class="fas fa-times text-danger me-2"></i>Sincronizar dados em tempo real</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <script>
                            // Check connection status
                            window.addEventListener('online', () => {
                                window.location.reload();
                            });
                            
                            // Update connection status
                            function updateConnectionStatus() {
                                if (navigator.onLine) {
                                    window.location.reload();
                                }
                            }
                            
                            setInterval(updateConnectionStatus, 5000);
                        </script>
                    </body>
                    </html>
                `, {
                    headers: { 'Content-Type': 'text/html' }
                }));
            })
        ]).then(() => {
            console.log('Service Worker: Installation complete');
            // Skip waiting to activate immediately
            self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== STATIC_CACHE_NAME && 
                        cacheName !== DYNAMIC_CACHE_NAME && 
                        cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activation complete');
            // Take control of all pages immediately
            self.clients.claim();
        })
    );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http requests
    if (!event.request.url.startsWith('http')) {
        return;
    }
    
    event.respondWith(handleFetch(event.request));
});

// Handle fetch requests with different strategies
async function handleFetch(request) {
    const url = new URL(request.url);
    
    try {
        // Network first for API calls and dynamic content
        if (shouldUseNetworkFirst(url.pathname)) {
            return await networkFirstStrategy(request);
        }
        
        // Cache first for static assets
        if (isStaticAsset(url.pathname)) {
            return await cacheFirstStrategy(request);
        }
        
        // Stale while revalidate for pages
        return await staleWhileRevalidateStrategy(request);
        
    } catch (error) {
        console.error('Service Worker: Fetch error:', error);
        return await getOfflineFallback(request);
    }
}

// Network first strategy
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Fall back to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

// Cache first strategy
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        throw error;
    }
}

// Stale while revalidate strategy
async function staleWhileRevalidateStrategy(request) {
    const cachedResponse = await caches.match(request);
    
    const networkResponse = fetch(request).then(response => {
        if (response.ok) {
            const cache = caches.open(DYNAMIC_CACHE_NAME);
            cache.then(c => c.put(request, response.clone()));
        }
        return response;
    }).catch(() => null);
    
    return cachedResponse || networkResponse;
}

// Get offline fallback
async function getOfflineFallback(request) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
        const offlinePage = await caches.match('/offline.html');
        if (offlinePage) {
            return offlinePage;
        }
    }
    
    // Return cached version if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // Return basic offline response
    return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' }
    });
}

// Check if route should use network first strategy
function shouldUseNetworkFirst(pathname) {
    return NETWORK_FIRST_ROUTES.some(route => pathname.startsWith(route));
}

// Check if request is for static asset
function isStaticAsset(pathname) {
    return pathname.startsWith('/static/') ||
           pathname.endsWith('.css') ||
           pathname.endsWith('.js') ||
           pathname.endsWith('.png') ||
           pathname.endsWith('.jpg') ||
           pathname.endsWith('.svg') ||
           pathname.endsWith('.woff') ||
           pathname.endsWith('.woff2');
}

// Background sync for form submissions
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync-reports') {
        console.log('Service Worker: Background sync triggered for reports');
        event.waitUntil(syncReports());
    }
    
    if (event.tag === 'background-sync-photos') {
        console.log('Service Worker: Background sync triggered for photos');
        event.waitUntil(syncPhotos());
    }
});

// Sync pending reports
async function syncReports() {
    try {
        // This would sync any pending reports stored in IndexedDB
        // For now, we'll just log the action
        console.log('Service Worker: Syncing pending reports...');
        
        // Get pending reports from IndexedDB or localStorage
        const pendingReports = await getPendingReports();
        
        for (const report of pendingReports) {
            try {
                await fetch('/reports/create', {
                    method: 'POST',
                    body: JSON.stringify(report),
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                
                // Remove from pending after successful sync
                await removePendingReport(report.id);
                
            } catch (error) {
                console.error('Service Worker: Failed to sync report:', error);
            }
        }
    } catch (error) {
        console.error('Service Worker: Sync reports failed:', error);
        throw error;
    }
}

// Sync pending photos
async function syncPhotos() {
    try {
        console.log('Service Worker: Syncing pending photos...');
        // Implementation for photo sync would go here
    } catch (error) {
        console.error('Service Worker: Sync photos failed:', error);
        throw error;
    }
}

// Get pending reports (placeholder - would use IndexedDB in production)
async function getPendingReports() {
    // This would retrieve pending reports from IndexedDB
    return [];
}

// Remove pending report (placeholder)
async function removePendingReport(reportId) {
    // This would remove the report from IndexedDB
    console.log('Service Worker: Removed pending report:', reportId);
}

// Handle push notifications
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received');
    
    let notificationData = {
        title: 'ELP Obras',
        body: 'Nova notificação disponível',
        icon: '/static/icons/icon-192.png',
        badge: '/static/icons/badge-72.png',
        tag: 'elp-notification',
        requireInteraction: false
    };
    
    if (event.data) {
        try {
            notificationData = { ...notificationData, ...event.data.json() };
        } catch (error) {
            console.error('Service Worker: Error parsing push data:', error);
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: notificationData.badge,
            tag: notificationData.tag,
            requireInteraction: notificationData.requireInteraction,
            actions: [
                {
                    action: 'open',
                    title: 'Abrir App'
                },
                {
                    action: 'close',
                    title: 'Fechar'
                }
            ]
        })
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'close') {
        return;
    }
    
    // Open the app
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // If app is already open, focus it
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            
            // Otherwise open new window
            if (clients.openWindow) {
                return clients.openWindow('/dashboard');
            }
        })
    );
});

// Handle messages from main app
self.addEventListener('message', (event) => {
    if (event.data && event.data.action) {
        switch (event.data.action) {
            case 'skipWaiting':
                self.skipWaiting();
                break;
                
            case 'cachePage':
                const cache = caches.open(DYNAMIC_CACHE_NAME);
                cache.then(c => c.add(event.data.url));
                break;
                
            case 'clearCache':
                caches.keys().then(cacheNames => {
                    return Promise.all(
                        cacheNames.map(cacheName => caches.delete(cacheName))
                    );
                });
                break;
                
            default:
                console.log('Service Worker: Unknown message action:', event.data.action);
        }
    }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'background-fetch-reports') {
        event.waitUntil(fetchLatestReports());
    }
});

// Fetch latest reports in background
async function fetchLatestReports() {
    try {
        console.log('Service Worker: Fetching latest reports in background');
        
        const response = await fetch('/api/reports/latest');
        if (response.ok) {
            // Cache the response
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put('/api/reports/latest', response.clone());
        }
    } catch (error) {
        console.error('Service Worker: Background fetch failed:', error);
    }
}

console.log('Service Worker: Script loaded');
