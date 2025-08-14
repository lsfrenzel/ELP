/**
 * ELP Obras - PWA Functionality
 * Handles service worker registration, app installation, and offline capabilities
 */

class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.installButton = null;
        
        this.init();
    }
    
    // Initialize PWA functionality
    init() {
        this.registerServiceWorker();
        this.setupInstallPrompt();
        this.checkInstallStatus();
        this.setupUpdateFlow();
        
        console.log('PWA Manager initialized');
    }
    
    // Register service worker
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered successfully:', registration);
                    
                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        console.log('New service worker version found');
                        this.handleServiceWorkerUpdate(registration);
                    });
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        }
    }
    
    // Setup install prompt
    setupInstallPrompt() {
        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (event) => {
            console.log('App install prompt available');
            
            // Prevent the default prompt
            event.preventDefault();
            
            // Store the event for later use
            this.deferredPrompt = event;
            
            // Show custom install prompt
            this.showInstallPrompt();
        });
        
        // Listen for app installed event
        window.addEventListener('appinstalled', (event) => {
            console.log('App successfully installed');
            this.isInstalled = true;
            this.hideInstallPrompt();
            
            // Show success message
            if (window.ELPApp) {
                window.ELPApp.showNotification('App instalado com sucesso!', 'success');
            }
        });
    }
    
    // Check if app is already installed
    checkInstallStatus() {
        // Check if running in standalone mode (installed)
        if (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
            console.log('App is running in installed mode');
        }
        
        // For Android, check if running in TWA or installed
        if (document.referrer.includes('android-app://')) {
            this.isInstalled = true;
            console.log('App is running as Android TWA');
        }
    }
    
    // Show custom install prompt
    showInstallPrompt() {
        if (this.isInstalled || !this.deferredPrompt) {
            return;
        }
        
        // Create install prompt UI
        const promptHTML = `
            <div class="install-prompt" id="installPrompt">
                <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-mobile-alt fa-2x me-3"></i>
                        <div>
                            <h6 class="mb-1">Instalar ELP Obras</h6>
                            <small>Adicione à tela inicial para acesso rápido</small>
                        </div>
                    </div>
                    <div>
                        <button class="btn btn-light btn-sm me-2" onclick="PWA.hideInstallPrompt()">
                            Não
                        </button>
                        <button class="btn btn-warning btn-sm" onclick="PWA.installApp()">
                            Instalar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing prompt
        const existingPrompt = document.getElementById('installPrompt');
        if (existingPrompt) {
            existingPrompt.remove();
        }
        
        // Add prompt to page
        document.body.insertAdjacentHTML('beforeend', promptHTML);
        
        // Show prompt with animation
        setTimeout(() => {
            const prompt = document.getElementById('installPrompt');
            if (prompt) {
                prompt.classList.add('show');
            }
        }, 1000);
        
        // Auto hide after 30 seconds
        setTimeout(() => {
            this.hideInstallPrompt();
        }, 30000);
    }
    
    // Hide install prompt
    hideInstallPrompt() {
        const prompt = document.getElementById('installPrompt');
        if (prompt) {
            prompt.classList.remove('show');
            setTimeout(() => {
                prompt.remove();
            }, 300);
        }
    }
    
    // Install the app
    installApp() {
        if (!this.deferredPrompt) {
            return;
        }
        
        // Show the install prompt
        this.deferredPrompt.prompt();
        
        // Handle the user's choice
        this.deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            
            // Clear the deferredPrompt
            this.deferredPrompt = null;
            this.hideInstallPrompt();
        });
    }
    
    // Handle service worker updates
    handleServiceWorkerUpdate(registration) {
        const newWorker = registration.installing;
        
        if (newWorker) {
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New version available
                    this.showUpdatePrompt();
                }
            });
        }
    }
    
    // Show update prompt
    showUpdatePrompt() {
        const updateHTML = `
            <div class="install-prompt" id="updatePrompt">
                <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-sync-alt fa-2x me-3 text-info"></i>
                        <div>
                            <h6 class="mb-1">Nova versão disponível</h6>
                            <small>Recarregue para obter as últimas melhorias</small>
                        </div>
                    </div>
                    <div>
                        <button class="btn btn-light btn-sm me-2" onclick="PWA.hideUpdatePrompt()">
                            Depois
                        </button>
                        <button class="btn btn-info btn-sm" onclick="PWA.updateApp()">
                            Atualizar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing prompts
        this.hideInstallPrompt();
        const existingPrompt = document.getElementById('updatePrompt');
        if (existingPrompt) {
            existingPrompt.remove();
        }
        
        // Add update prompt
        document.body.insertAdjacentHTML('beforeend', updateHTML);
        
        // Show with animation
        setTimeout(() => {
            const prompt = document.getElementById('updatePrompt');
            if (prompt) {
                prompt.classList.add('show');
            }
        }, 500);
    }
    
    // Hide update prompt
    hideUpdatePrompt() {
        const prompt = document.getElementById('updatePrompt');
        if (prompt) {
            prompt.classList.remove('show');
            setTimeout(() => {
                prompt.remove();
            }, 300);
        }
    }
    
    // Update the app
    updateApp() {
        this.hideUpdatePrompt();
        
        // Tell service worker to skip waiting
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ action: 'skipWaiting' });
        }
        
        // Reload the page
        window.location.reload();
    }
    
    // Setup update flow
    setupUpdateFlow() {
        // Listen for service worker updates
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                // New service worker has taken control
                console.log('Service worker updated and took control');
            });
        }
    }
    
    // Check for app updates manually
    checkForUpdates() {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.getRegistration().then(registration => {
                if (registration) {
                    registration.update();
                }
            });
        }
    }
    
    // Get installation status
    getInstallationStatus() {
        return {
            isInstalled: this.isInstalled,
            canInstall: !!this.deferredPrompt,
            isStandalone: window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches
        };
    }
    
    // Force app cache update
    forceUpdate() {
        if ('caches' in window) {
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        return caches.delete(cacheName);
                    })
                );
            }).then(() => {
                console.log('All caches cleared');
                window.location.reload();
            });
        }
    }
}

// Initialize PWA Manager
const PWA = new PWAManager();

// Make PWA manager globally available
window.PWA = PWA;

// Add iOS specific meta tags for better PWA support
document.addEventListener('DOMContentLoaded', function() {
    // Add iOS meta tags if not present
    const iosTags = [
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'ELP Obras' },
        { name: 'mobile-web-app-capable', content: 'yes' }
    ];
    
    iosTags.forEach(tag => {
        if (!document.querySelector(`meta[name="${tag.name}"]`)) {
            const meta = document.createElement('meta');
            meta.name = tag.name;
            meta.content = tag.content;
            document.head.appendChild(meta);
        }
    });
    
    // Add iOS splash screens for different device sizes
    const splashScreens = [
        {
            href: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            sizes: "2048x2732",
            rel: "apple-touch-startup-image"
        }
    ];
    
    splashScreens.forEach(screen => {
        if (!document.querySelector(`link[sizes="${screen.sizes}"]`)) {
            const link = document.createElement('link');
            link.href = screen.href;
            link.sizes = screen.sizes;
            link.rel = screen.rel;
            document.head.appendChild(link);
        }
    });
});
