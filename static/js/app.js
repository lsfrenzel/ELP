/**
 * ELP Obras - Main Application JavaScript
 * Handles core application functionality, form validation, and UI interactions
 */

// Global app state
window.ELPApp = {
    currentUser: null,
    isOnline: navigator.onLine,
    notifications: [],
    
    // Initialize the application
    init: function() {
        this.setupEventListeners();
        this.checkOnlineStatus();
        this.initializeFormValidation();
        this.loadUserPreferences();
        console.log('ELP Obras App initialized');
    },
    
    // Setup global event listeners
    setupEventListeners: function() {
        // Online/offline status
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
        
        // Form submissions with loading states
        document.addEventListener('submit', this.handleFormSubmit.bind(this));
        
        // Navigation state management
        window.addEventListener('popstate', this.handleNavigation.bind(this));
        
        // Mobile menu handling
        this.setupMobileNavigation();
    },
    
    // Handle online status change
    handleOnline: function() {
        this.isOnline = true;
        this.hideOfflineIndicator();
        this.syncPendingData();
        this.showNotification('Conexão restaurada', 'success');
    },
    
    // Handle offline status change
    handleOffline: function() {
        this.isOnline = false;
        this.showOfflineIndicator();
        this.showNotification('Modo offline ativado', 'warning');
    },
    
    // Show offline indicator
    showOfflineIndicator: function() {
        let indicator = document.getElementById('offlineIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'offlineIndicator';
            indicator.className = 'offline-indicator';
            indicator.innerHTML = '<i class="fas fa-wifi me-2"></i>Modo Offline';
            document.body.appendChild(indicator);
        }
        indicator.classList.add('show');
    },
    
    // Hide offline indicator
    hideOfflineIndicator: function() {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.classList.remove('show');
        }
    },
    
    // Check current online status
    checkOnlineStatus: function() {
        if (!navigator.onLine) {
            this.handleOffline();
        }
    },
    
    // Handle form submissions with loading states
    handleFormSubmit: function(event) {
        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        if (submitBtn && !submitBtn.disabled) {
            const originalText = submitBtn.innerHTML;
            const loadingText = submitBtn.dataset.loading || '<i class="fas fa-spinner fa-spin me-1"></i>Carregando...';
            
            // Set loading state
            submitBtn.innerHTML = loadingText;
            submitBtn.disabled = true;
            
            // Restore button after 10 seconds (fallback)
            setTimeout(() => {
                if (submitBtn.disabled) {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
            }, 10000);
        }
    },
    
    // Initialize form validation
    initializeFormValidation: function() {
        // Custom validation for email fields
        document.addEventListener('input', function(event) {
            if (event.target.type === 'email') {
                ELPApp.validateEmail(event.target);
            }
        });
        
        // Phone number formatting
        document.addEventListener('input', function(event) {
            if (event.target.type === 'tel' || event.target.name === 'telefone') {
                ELPApp.formatPhoneNumber(event.target);
            }
        });
        
        // Required field validation
        document.addEventListener('blur', function(event) {
            if (event.target.hasAttribute('required')) {
                ELPApp.validateRequiredField(event.target);
            }
        });
    },
    
    // Validate email field
    validateEmail: function(field) {
        const email = field.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (email && !emailRegex.test(email)) {
            this.showFieldError(field, 'Email inválido');
            return false;
        } else {
            this.clearFieldError(field);
            return true;
        }
    },
    
    // Format phone number
    formatPhoneNumber: function(field) {
        let value = field.value.replace(/\D/g, '');
        
        if (value.length <= 11) {
            if (value.length <= 10) {
                value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
            } else {
                value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            }
            field.value = value;
        }
    },
    
    // Validate required field
    validateRequiredField: function(field) {
        const value = field.value.trim();
        
        if (!value) {
            this.showFieldError(field, 'Este campo é obrigatório');
            return false;
        } else {
            this.clearFieldError(field);
            return true;
        }
    },
    
    // Show field error
    showFieldError: function(field, message) {
        this.clearFieldError(field);
        
        field.classList.add('is-invalid');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'invalid-feedback';
        errorDiv.textContent = message;
        field.parentNode.appendChild(errorDiv);
    },
    
    // Clear field error
    clearFieldError: function(field) {
        field.classList.remove('is-invalid');
        const errorDiv = field.parentNode.querySelector('.invalid-feedback');
        if (errorDiv) {
            errorDiv.remove();
        }
    },
    
    // Setup mobile navigation
    setupMobileNavigation: function() {
        const navbarToggler = document.querySelector('.navbar-toggler');
        const navbarCollapse = document.querySelector('.navbar-collapse');
        
        if (navbarToggler && navbarCollapse) {
            // Close mobile menu when clicking outside
            document.addEventListener('click', function(event) {
                if (!navbarToggler.contains(event.target) && !navbarCollapse.contains(event.target)) {
                    if (navbarCollapse.classList.contains('show')) {
                        navbarToggler.click();
                    }
                }
            });
            
            // Close mobile menu when clicking on nav links
            navbarCollapse.addEventListener('click', function(event) {
                if (event.target.classList.contains('nav-link')) {
                    if (navbarCollapse.classList.contains('show')) {
                        navbarToggler.click();
                    }
                }
            });
        }
    },
    
    // Handle navigation state
    handleNavigation: function(event) {
        // Update active nav item based on current URL
        this.updateActiveNavigation();
    },
    
    // Update active navigation item
    updateActiveNavigation: function() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            }
        });
    },
    
    // Show notification
    showNotification: function(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} notification-toast`;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <span>${message}</span>
                <button type="button" class="btn-close btn-close-white" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    },
    
    // Load user preferences from localStorage
    loadUserPreferences: function() {
        const preferences = localStorage.getItem('elp_preferences');
        if (preferences) {
            try {
                this.userPreferences = JSON.parse(preferences);
            } catch (error) {
                console.error('Error loading user preferences:', error);
                this.userPreferences = {};
            }
        } else {
            this.userPreferences = {};
        }
    },
    
    // Save user preferences to localStorage
    saveUserPreferences: function() {
        try {
            localStorage.setItem('elp_preferences', JSON.stringify(this.userPreferences));
        } catch (error) {
            console.error('Error saving user preferences:', error);
        }
    },
    
    // Sync pending data when online
    syncPendingData: function() {
        const pendingData = localStorage.getItem('elp_pending_sync');
        if (pendingData && this.isOnline) {
            try {
                const data = JSON.parse(pendingData);
                // Process pending sync data
                console.log('Syncing pending data:', data);
                // Clear pending data after sync
                localStorage.removeItem('elp_pending_sync');
            } catch (error) {
                console.error('Error syncing pending data:', error);
            }
        }
    },
    
    // Utility functions
    utils: {
        // Format currency
        formatCurrency: function(amount) {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(amount);
        },
        
        // Format date
        formatDate: function(date) {
            return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
        },
        
        // Format datetime
        formatDateTime: function(date) {
            return new Intl.DateTimeFormat('pt-BR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date(date));
        },
        
        // Generate UUID
        generateUUID: function() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },
        
        // Debounce function
        debounce: function(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },
        
        // Throttle function
        throttle: function(func, limit) {
            let inThrottle;
            return function() {
                const args = arguments;
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    ELPApp.init();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .notification-toast {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border: none;
        border-radius: 8px;
    }
`;
document.head.appendChild(style);
