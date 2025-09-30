// Service Worker Registration and Update Handling
// sw-register.js

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker();
  });
}

let updateAvailable = false;
let deferredPrompt = null;

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });
    
    console.log('SW registered:', registration);
    
    // Handle service worker updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('New service worker available');
          updateAvailable = true;
          showUpdateNotification();
        }
      });
    });
    
    // Handle controller change (when new SW takes control)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service worker controller changed');
      if (updateAvailable) {
        window.location.reload();
      }
    });
    
    // Handle messages from service worker
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    
    // Check for updates periodically (every minute)
    setInterval(() => {
      registration.update();
    }, 60000);
    
    // Handle PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallPrompt();
    });
    
  } catch (error) {
    console.error('SW registration failed:', error);
  }
}

function handleServiceWorkerMessage(event) {
  const { type, message, url, data } = event.data;
  
  switch (type) {
    case 'SW_UPDATED':
      console.log('Service worker updated:', message);
      updateAvailable = true;
      showUpdateNotification();
      break;
      
    case 'SW_UPDATE_AVAILABLE':
      console.log('Service worker update available:', message);
      updateAvailable = true;
      showUpdateNotification();
      break;
      
    case 'CONTENT_UPDATED':
      console.log('Content updated:', url);
      refreshContent(url);
      break;
      
    case 'CACHE_UPDATED':
      console.log('Cache updated in background:', url);
      if (data && data.showNotification) {
        showCacheUpdateNotification(data.message || 'Content updated in background');
      }
      break;
      
    case 'SW_ACTIVATED':
      console.log('Service worker activated:', message);
      break;
      
    case 'CACHE_ERROR':
      console.warn('Cache error:', message, url);
      break;
      
    case 'OFFLINE_FALLBACK':
      console.log('Serving offline fallback for:', url);
      showOfflineNotification();
      break;
  }
}

function showUpdateNotification() {
  // Remove existing notification if any
  const existing = document.getElementById('sw-update-notification');
  if (existing) {
    existing.remove();
  }
  
  const notification = document.createElement('div');
  notification.id = 'sw-update-notification';
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #007bff;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      max-width: 320px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideInRight 0.3s ease-out;
    ">
      <div style="font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
        <span>🔄</span>
        Update Available
      </div>
      <div style="font-size: 14px; margin-bottom: 12px; opacity: 0.9;">
        A new version with performance improvements is available.
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="applyUpdate()" style="
          background: white;
          color: #007bff;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
        ">
          Update Now
        </button>
        <button onclick="dismissUpdateNotification()" style="
          background: transparent;
          color: white;
          border: 1px solid rgba(255,255,255,0.5);
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        ">
          Later
        </button>
      </div>
    </div>
    
    <style>
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    </style>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    dismissUpdateNotification();
  }, 10000);
}

function showCacheUpdateNotification(message = 'Content updated in background') {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: #28a745;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
      max-width: 300px;
      display: flex;
      align-items: center;
      gap: 8px;
    ">
      <span>✅</span>
      ${message}
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Fade in
  setTimeout(() => {
    notification.firstElementChild.style.opacity = '1';
  }, 100);
  
  // Fade out and remove
  setTimeout(() => {
    notification.firstElementChild.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

function showOfflineNotification() {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #ffc107;
      color: #000;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
      max-width: 300px;
      display: flex;
      align-items: center;
      gap: 8px;
    ">
      <span>⚠️</span>
      You're offline. Some content may not be available.
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Fade in
  setTimeout(() => {
    notification.firstElementChild.style.opacity = '1';
  }, 100);
  
  // Fade out and remove
  setTimeout(() => {
    notification.firstElementChild.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

function showInstallPrompt() {
  // Only show install prompt on mobile or if not already installed
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  
  if (!deferredPrompt || isStandalone) return;
  
  // Create a subtle install prompt
  const installPrompt = document.createElement('div');
  installPrompt.id = 'pwa-install-prompt';
  installPrompt.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1a1a1a;
      color: white;
      padding: 12px 20px;
      border-radius: 25px;
      font-size: 14px;
      z-index: 10000;
      border: 1px solid #333;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 90vw;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    ">
      <span style="font-size: 20px;">📱</span>
      <span>Install Meow app for better experience</span>
      <button onclick="installApp()" style="
        background: #ff4b2b;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 15px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
      ">
        Install
      </button>
      <button onclick="dismissInstallPrompt()" style="
        background: transparent;
        color: #ccc;
        border: none;
        cursor: pointer;
        font-size: 16px;
        padding: 2px;
      ">
        ×
      </button>
    </div>
  `;
  
  document.body.appendChild(installPrompt);
  
  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    dismissInstallPrompt();
  }, 8000);
}

function applyUpdate() {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'FORCE_UPDATE'
    });
  }
  
  dismissUpdateNotification();
  
  // Show loading state
  const loadingNotification = document.createElement('div');
  loadingNotification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #17a2b8;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 10px;
    ">
      <div style="
        width: 16px;
        height: 16px;
        border: 2px solid #ffffff50;
        border-top: 2px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      Updating...
    </div>
    
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
  
  document.body.appendChild(loadingNotification);
  
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

function dismissUpdateNotification() {
  const notification = document.getElementById('sw-update-notification');
  if (notification) {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }
}

async function installApp() {
  if (!deferredPrompt) return;
  
  try {
    const result = await deferredPrompt.prompt();
    console.log('PWA install prompt result:', result);
    
    if (result.outcome === 'accepted') {
      showCacheUpdateNotification('App installed successfully! 🎉');
    }
    
    deferredPrompt = null;
    dismissInstallPrompt();
    
  } catch (error) {
    console.error('Error installing PWA:', error);
  }
}

function dismissInstallPrompt() {
  const prompt = document.getElementById('pwa-install-prompt');
  if (prompt) {
    prompt.style.transform = 'translateY(100px)';
    prompt.style.opacity = '0';
    setTimeout(() => {
      prompt.remove();
    }, 300);
  }
  deferredPrompt = null;
}

function refreshContent(url) {
  if (url.includes('.json')) {
    console.log('JSON content updated, clearing cache and refreshing data');
    
    // Clear cached show data for current language if it's a show-related JSON
    const currentLanguage = getCurrentLanguage();
    const cacheKey = `cached_kukufm_shows_${currentLanguage}`;
    const masterCacheKey = `cached_master_${currentLanguage}`;
    
    try {
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(masterCacheKey);
      console.log('Cleared cached data for', currentLanguage);
      
      // Show notification
      showCacheUpdateNotification('New content available! Refresh to see updates.');
      
    } catch (e) {
      console.warn('Failed to clear cache:', e);
    }
  }
  
  if (url.includes('.html')) {
    console.log('HTML content updated, consider page refresh');
    showCacheUpdateNotification('Page updated! Refresh for latest version.');
  }
}

function getCurrentLanguage() {
  const path = window.location.pathname;
  const filename = path.split('/').pop() || 'index.html';
  
  if (filename === 'index.html') return 'tamil';
  return filename.replace('.html', '');
}

// Cache management utilities
function clearAllCache() {
  try {
    // Clear localStorage cache
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('cached_kukufm_') || key.startsWith('cached_master_')) {
        localStorage.removeItem(key);
      }
    });
    
    // Clear service worker cache
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName.includes('meow')) {
              return caches.delete(cacheName);
            }
          })
        );
      });
    }
    
    console.log('All caches cleared');
    showCacheUpdateNotification('Cache cleared successfully!');
    
  } catch (e) {
    console.error('Failed to clear cache:', e);
  }
}

// Performance monitoring
function monitorPerformance() {
  if ('performance' in window && 'PerformanceObserver' in window) {
    // Monitor navigation timing
    window.addEventListener('load', () => {
      const navTiming = performance.getEntriesByType('navigation')[0];
      const loadTime = navTiming.loadEventEnd - navTiming.fetchStart;
      
      console.log('Page load time:', Math.round(loadTime) + 'ms');
      
      // Report slow loads
      if (loadTime > 5000) {
        console.warn('Slow page load detected:', Math.round(loadTime) + 'ms');
      }
    });
    
    // Monitor resource loading
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > 2000) {
          console.warn('Slow resource:', entry.name, Math.round(entry.duration) + 'ms');
        }
      });
    });
    
    observer.observe({ entryTypes: ['resource'] });
  }
}

// Network status monitoring
function monitorNetworkStatus() {
  function updateOnlineStatus() {
    const condition = navigator.onLine ? 'online' : 'offline';
    console.log('Network status:', condition);
    
    if (!navigator.onLine) {
      showOfflineNotification();
    }
  }
  
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Initial check
  updateOnlineStatus();
}

// Initialize monitoring
if (typeof window !== 'undefined') {
  monitorPerformance();
  monitorNetworkStatus();
  
  // Add cache management to global scope for debugging
  window.clearAllCache = clearAllCache;
  window.showUpdateNotification = showUpdateNotification;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    registerServiceWorker,
    clearAllCache,
    applyUpdate,
    installApp
  };
}