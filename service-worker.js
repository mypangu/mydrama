// Optimized Service Worker for Meow Streaming Site
// service-worker.js

const CACHE_VERSION = '1010250100';
const CACHE_NAMES = {
  STATIC: `meow-static-${CACHE_VERSION}`,
  DYNAMIC: `meow-dynamic-${CACHE_VERSION}`,
  IMAGES: `meow-images-${CACHE_VERSION}`,
  JSON: `meow-json-${CACHE_VERSION}`,
  FONTS: `meow-fonts-${CACHE_VERSION}`
};

// Static assets to cache immediately
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/telugu.html',
  '/malayalam.html',
  '/kannada.html',
  '/hindi.html',
  '/bengali.html',
  '/english.html',
  '/tamilaudio.html',
  '/sw-register.js',
  '/manifest.json',
  '/favicon.ico'
];

// Dynamic assets that should be cached on first request
const DYNAMIC_CACHE_PATTERNS = [
  /\.html$/,
  /\.css$/,
  /\.js$/,
  /master_.*\.json$/
];

// Image cache patterns
const IMAGE_CACHE_PATTERNS = [
  /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i,
  /share_image_url/,
  /placeholder/
];

// JSON cache patterns (for show data)
const JSON_CACHE_PATTERNS = [
  /\.json$/,
  /master_/
];

// External resources to cache
const EXTERNAL_CACHE_PATTERNS = [
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /cdnjs\.cloudflare\.com/,
  /cdn\.jsdelivr\.net/
];

// Network-first resources (videos)
const NETWORK_FIRST_PATTERNS = [
  /\.m3u8$/,
  /\.ts$/,
  /\.mp4$/,
  /\.webm$/,
  /video/
];

// Cache size limits
const CACHE_LIMITS = {
  IMAGES: 5000, // Maximum 100 images
  JSON: 5000,   // Maximum 200 JSON files
  DYNAMIC: 50  // Maximum 50 dynamic resources
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_NAMES.STATIC).then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_CACHE_URLS.map(url => new Request(url, { cache: 'reload' })));
      }),
      
      // Skip waiting to activate immediately
      self.skipWaiting()
    ]).then(() => {
      console.log('Service Worker installed successfully');
      broadcastMessage('SW_ACTIVATED', 'Service Worker activated');
    }).catch((error) => {
      console.error('Service Worker installation failed:', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        const deletePromises = cacheNames.map((cacheName) => {
          if (cacheName.startsWith('meow-') && !Object.values(CACHE_NAMES).includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        });
        return Promise.all(deletePromises);
      }),
      
      // Claim all clients
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker activated successfully');
      broadcastMessage('SW_ACTIVATED', 'Service Worker is now controlling all pages');
    })
  );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Route to appropriate strategy
  if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname + url.search))) {
    event.respondWith(networkFirstStrategy(request));
  } else if (IMAGE_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname + url.search))) {
    event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.IMAGES));
  } else if (JSON_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(staleWhileRevalidateStrategy(request, CACHE_NAMES.JSON));
  } else if (EXTERNAL_CACHE_PATTERNS.some(pattern => pattern.test(url.hostname))) {
    event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.FONTS));
  } else if (DYNAMIC_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(staleWhileRevalidateStrategy(request, CACHE_NAMES.DYNAMIC));
  } else {
    event.respondWith(networkFirstStrategy(request));
  }
});

// Cache-first strategy (for images, fonts)
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Optionally update in background
      updateInBackground(request, cache);
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clone and cache the response
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
      
      // Manage cache size
      await manageCacheSize(cache, cacheName);
      
      broadcastMessage('CACHE_UPDATED', 'Resource cached', request.url);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('Cache-first strategy failed:', error, request.url);
    broadcastMessage('CACHE_ERROR', error.message, request.url);
    
    // Return offline fallback for images
    if (IMAGE_CACHE_PATTERNS.some(pattern => pattern.test(request.url))) {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="#1a1a1a"/><text x="150" y="200" text-anchor="middle" fill="#666" font-family="Arial" font-size="16">Image Unavailable</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    
    throw error;
  }
}

// Network-first strategy (for videos, real-time data)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
    
  } catch (error) {
    console.error('Network-first strategy failed:', error, request.url);
    
    // Try cache as fallback
    const cache = await caches.open(CACHE_NAMES.DYNAMIC);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      broadcastMessage('OFFLINE_FALLBACK', 'Serving cached version', request.url);
      return cachedResponse;
    }
    
    // Return offline page for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
      return new Response(
        `<!DOCTYPE html>
        <html>
        <head>
          <title>Offline - Meow</title>
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; background: #0a0a0a; color: white; }
            .offline { font-size: 48px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="offline">📱</div>
          <h1>You're Offline</h1>
          <p>Check your connection and try again</p>
        </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    
    throw error;
  }
}

// Stale-while-revalidate strategy (for JSON, dynamic content)
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Always try to update from network
  const networkPromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
      
      // Manage cache size
      await manageCacheSize(cache, cacheName);
      
      // Notify about update if content changed
      if (cachedResponse) {
        const cachedText = await cachedResponse.clone().text();
        const networkText = await networkResponse.clone().text();
        
        if (cachedText !== networkText) {
          broadcastMessage('CONTENT_UPDATED', 'Content updated', request.url);
        }
      } else {
        broadcastMessage('CACHE_UPDATED', 'New content cached', request.url);
      }
    }
    return networkResponse;
  }).catch((error) => {
    console.error('Network update failed:', error, request.url);
    broadcastMessage('CACHE_ERROR', error.message, request.url);
    return cachedResponse;
  });
  
  // Return cached response immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Otherwise wait for network
  return networkPromise;
}

// Update resource in background without blocking response
async function updateInBackground(request, cache) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
      broadcastMessage('CACHE_UPDATED', 'Background update completed', request.url, {
        showNotification: false
      });
    }
  } catch (error) {
    // Silently fail background updates
    console.warn('Background update failed:', error, request.url);
  }
}

// Manage cache size to prevent unlimited growth
async function manageCacheSize(cache, cacheName) {
  const limit = CACHE_LIMITS[cacheName.split('-')[1]?.toUpperCase()] || 50;
  const keys = await cache.keys();
  
  if (keys.length > limit) {
    const deleteCount = keys.length - limit;
    const keysToDelete = keys.slice(0, deleteCount);
    
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
    console.log(`Cleaned up ${deleteCount} old entries from ${cacheName}`);
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'FORCE_UPDATE':
      handleForceUpdate();
      break;
      
    case 'CLEAR_CACHE':
      handleClearCache(data?.cacheName);
      break;
      
    case 'GET_CACHE_INFO':
      handleGetCacheInfo(event);
      break;
      
    case 'PREFETCH_RESOURCES':
      handlePrefetchResources(data?.urls || []);
      break;
  }
});

// Handle force update request
async function handleForceUpdate() {
  try {
    // Clear all caches
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith('meow-'))
        .map(name => caches.delete(name))
    );
    
    // Notify clients about update
    broadcastMessage('SW_UPDATED', 'Service Worker updated, please reload');
    
    // Skip waiting and claim clients
    await self.skipWaiting();
    
  } catch (error) {
    console.error('Force update failed:', error);
  }
}

// Handle cache clearing
async function handleClearCache(cacheName) {
  try {
    if (cacheName) {
      await caches.delete(cacheName);
      console.log('Cache cleared:', cacheName);
    } else {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name.startsWith('meow-'))
          .map(name => caches.delete(name))
      );
      console.log('All caches cleared');
    }
    
    broadcastMessage('CACHE_UPDATED', 'Cache cleared successfully');
    
  } catch (error) {
    console.error('Clear cache failed:', error);
  }
}

// Handle cache info request
async function handleGetCacheInfo(event) {
  try {
    const cacheInfo = {};
    
    for (const [key, cacheName] of Object.entries(CACHE_NAMES)) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      cacheInfo[key] = {
        name: cacheName,
        count: keys.length,
        urls: keys.slice(0, 5).map(req => req.url) // First 5 URLs as sample
      };
    }
    
    event.ports[0].postMessage({
      type: 'CACHE_INFO',
      data: cacheInfo
    });
    
  } catch (error) {
    console.error('Get cache info failed:', error);
    event.ports[0].postMessage({
      type: 'CACHE_ERROR',
      error: error.message
    });
  }
}

// Handle prefetch requests
async function handlePrefetchResources(urls) {
  try {
    const prefetchPromises = urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          // Cache based on resource type
          let cacheName = CACHE_NAMES.DYNAMIC;
          
          if (IMAGE_CACHE_PATTERNS.some(pattern => pattern.test(url))) {
            cacheName = CACHE_NAMES.IMAGES;
          } else if (JSON_CACHE_PATTERNS.some(pattern => pattern.test(url))) {
            cacheName = CACHE_NAMES.JSON;
          }
          
          const cache = await caches.open(cacheName);
          await cache.put(url, response.clone());
          
          console.log('Prefetched and cached:', url);
        }
      } catch (error) {
        console.warn('Prefetch failed:', url, error);
      }
    });
    
    await Promise.all(prefetchPromises);
    broadcastMessage('CACHE_UPDATED', `Prefetched ${urls.length} resources`, null, {
      showNotification: true,
      message: `${urls.length} resources cached for offline use`
    });
    
  } catch (error) {
    console.error('Prefetch failed:', error);
  }
}

// Broadcast message to all clients
async function broadcastMessage(type, message, url = null, data = null) {
  const clients = await self.clients.matchAll();
  
  const messageData = {
    type,
    message,
    url,
    data,
    timestamp: Date.now()
  };
  
  clients.forEach(client => {
    client.postMessage(messageData);
  });
}

// Background sync for failed requests (if supported)
if ('sync' in self.registration) {
  self.addEventListener('sync', (event) => {
    if (event.tag === 'retry-failed-requests') {
      event.waitUntil(retryFailedRequests());
    }
  });
}

// Retry failed requests (basic implementation)
async function retryFailedRequests() {
  console.log('Retrying failed requests...');
  // Implementation would depend on how you store failed requests
  // This is a placeholder for the functionality
}

// Periodic cache cleanup
async function performPeriodicCleanup() {
  try {
    console.log('Performing periodic cache cleanup...');
    
    // Clean up each cache
    for (const cacheName of Object.values(CACHE_NAMES)) {
      const cache = await caches.open(cacheName);
      await manageCacheSize(cache, cacheName);
    }
    
    // Clean up expired entries (older than 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const cacheName of Object.values(CACHE_NAMES)) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      
      for (const request of keys) {
        const response = await cache.match(request);
        const dateHeader = response?.headers.get('date');
        
        if (dateHeader) {
          const responseDate = new Date(dateHeader).getTime();
          if (responseDate < sevenDaysAgo) {
            await cache.delete(request);
            console.log('Deleted expired cache entry:', request.url);
          }
        }
      }
    }
    
    console.log('Periodic cleanup completed');
    
  } catch (error) {
    console.error('Periodic cleanup failed:', error);
  }
}

// Schedule periodic cleanup (every 24 hours when service worker is active)
setInterval(() => {
  performPeriodicCleanup();
}, 24 * 60 * 60 * 1000);

console.log(`Service Worker ${CACHE_VERSION} loaded successfully`);