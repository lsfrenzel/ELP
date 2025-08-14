/**
 * ELP Obras - Geolocation Functionality
 * Handles GPS location services for construction site check-ins
 */

class GeolocationManager {
    constructor() {
        this.currentPosition = null;
        this.watchId = null;
        this.options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        };
        
        this.init();
    }
    
    // Initialize geolocation functionality
    init() {
        this.checkGeolocationSupport();
        console.log('Geolocation Manager initialized');
    }
    
    // Check if geolocation is supported
    checkGeolocationSupport() {
        if (!navigator.geolocation) {
            console.error('Geolocation is not supported by this browser');
            return false;
        }
        return true;
    }
    
    // Get current position
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!this.checkGeolocationSupport()) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            // Show loading state
            this.showLocationStatus('Obtendo localização...', 'loading');
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentPosition = position;
                    this.showLocationSuccess(position);
                    resolve(position);
                },
                (error) => {
                    this.handleGeolocationError(error);
                    reject(error);
                },
                this.options
            );
        });
    }
    
    // Watch position changes
    watchPosition() {
        if (!this.checkGeolocationSupport()) {
            return null;
        }
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentPosition = position;
                this.onPositionUpdate(position);
            },
            (error) => {
                this.handleGeolocationError(error);
            },
            this.options
        );
        
        return this.watchId;
    }
    
    // Stop watching position
    clearWatch() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }
    
    // Handle geolocation errors
    handleGeolocationError(error) {
        let message = '';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Acesso à localização negado. Verifique as permissões do navegador.';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Informações de localização não disponíveis.';
                break;
            case error.TIMEOUT:
                message = 'Tempo limite para obter localização excedido.';
                break;
            default:
                message = 'Erro desconhecido ao obter localização.';
                break;
        }
        
        console.error('Geolocation error:', error);
        this.showLocationError(message);
        
        // Show manual input option
        this.showManualLocationInput();
    }
    
    // Show location status
    showLocationStatus(message, type = 'info') {
        const statusElement = document.getElementById('locationStatus');
        if (!statusElement) return;
        
        const iconClass = type === 'loading' ? 'fas fa-spinner fa-spin' : 'fas fa-map-marker-alt';
        const alertClass = type === 'loading' ? 'alert-info' : 'alert-warning';
        
        statusElement.innerHTML = `
            <div class="alert ${alertClass} text-center">
                <i class="${iconClass} me-2"></i>${message}
            </div>
        `;
    }
    
    // Show location success
    async showLocationSuccess(position) {
        const statusElement = document.getElementById('locationStatus');
        if (!statusElement) return;
        
        const { latitude, longitude, accuracy } = position.coords;
        
        // Show loading while getting address
        statusElement.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-spinner fa-spin me-2"></i>
                <strong>Obtendo endereço...</strong>
            </div>
        `;
        
        // Get address from coordinates
        const address = await this.getAddressFromCoordinates(latitude, longitude);
        
        statusElement.innerHTML = `
            <div class="alert alert-success">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <i class="fas fa-check-circle me-2"></i>
                        <strong>Localização obtida</strong>
                    </div>
                    <button class="btn btn-sm btn-outline-success" onclick="GeoLocation.showLocationDetails()">
                        Ver detalhes
                    </button>
                </div>
                <div class="mt-2">
                    <strong>Endereço:</strong> ${address}
                </div>
                <small class="d-block mt-2">
                    Precisão: ${Math.round(accuracy)}m
                </small>
            </div>
        `;
        
        // Fill hidden form fields
        this.fillLocationFields(latitude, longitude);
        
        // Fill address field if it exists
        const addressField = document.getElementById('endereco_gps');
        if (addressField) {
            addressField.value = address;
        }
        
        // Show location on map (if map container exists)
        this.showLocationOnMap(latitude, longitude);
    }
    
    // Show location error
    showLocationError(message) {
        const statusElement = document.getElementById('locationStatus');
        if (!statusElement) return;
        
        statusElement.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${message}
            </div>
        `;
    }
    
    // Fill location form fields
    fillLocationFields(latitude, longitude) {
        const latField = document.getElementById('latitude');
        const lngField = document.getElementById('longitude');
        
        if (latField) latField.value = latitude;
        if (lngField) lngField.value = longitude;
    }
    
    // Show manual location input
    showManualLocationInput() {
        const statusElement = document.getElementById('locationStatus');
        if (!statusElement) return;
        
        setTimeout(() => {
            statusElement.innerHTML = `
                <div class="alert alert-warning">
                    <p><i class="fas fa-map-marker-alt me-2"></i>Localização automática falhou</p>
                    <div class="row g-2">
                        <div class="col-6">
                            <input type="number" class="form-control form-control-sm" 
                                   id="manualLatitude" placeholder="Latitude" step="any">
                        </div>
                        <div class="col-6">
                            <input type="number" class="form-control form-control-sm" 
                                   id="manualLongitude" placeholder="Longitude" step="any">
                        </div>
                    </div>
                    <div class="mt-2">
                        <button class="btn btn-sm btn-warning w-100" onclick="GeoLocation.setManualLocation()">
                            Confirmar Localização Manual
                        </button>
                    </div>
                </div>
            `;
        }, 2000);
    }
    
    // Set manual location
    setManualLocation() {
        const latField = document.getElementById('manualLatitude');
        const lngField = document.getElementById('manualLongitude');
        
        if (!latField || !lngField) return;
        
        const latitude = parseFloat(latField.value);
        const longitude = parseFloat(lngField.value);
        
        if (isNaN(latitude) || isNaN(longitude)) {
            alert('Por favor, insira coordenadas válidas');
            return;
        }
        
        // Validate coordinate ranges
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            alert('Coordenadas fora do intervalo válido');
            return;
        }
        
        this.fillLocationFields(latitude, longitude);
        
        const statusElement = document.getElementById('locationStatus');
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-map-marker-alt me-2"></i>
                    <strong>Localização manual definida</strong>
                    <small class="d-block mt-1">
                        ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
                    </small>
                </div>
            `;
        }
    }
    
    // Show location details
    showLocationDetails() {
        if (!this.currentPosition) return;
        
        const { latitude, longitude, accuracy, altitude, heading, speed } = this.currentPosition.coords;
        const timestamp = new Date(this.currentPosition.timestamp);
        
        const details = `
            <strong>Detalhes da Localização:</strong><br>
            Latitude: ${latitude.toFixed(6)}<br>
            Longitude: ${longitude.toFixed(6)}<br>
            Precisão: ${Math.round(accuracy)}m<br>
            ${altitude ? `Altitude: ${Math.round(altitude)}m<br>` : ''}
            ${heading ? `Direção: ${Math.round(heading)}°<br>` : ''}
            ${speed ? `Velocidade: ${Math.round(speed * 3.6)} km/h<br>` : ''}
            Obtido em: ${timestamp.toLocaleString('pt-BR')}
        `;
        
        // Show in modal or alert
        if (window.ELPApp) {
            window.ELPApp.showNotification(details, 'info', 8000);
        } else {
            alert(details.replace(/<br>/g, '\n').replace(/<strong>|<\/strong>/g, ''));
        }
    }
    
    // Show location on map (basic implementation)
    showLocationOnMap(latitude, longitude) {
        const mapContainer = document.getElementById('locationMap');
        if (!mapContainer) return;
        
        // Create simple static map link
        const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;
        
        mapContainer.innerHTML = `
            <iframe 
                src="${mapUrl}" 
                width="100%" 
                height="200" 
                style="border:0; border-radius: 8px;" 
                allowfullscreen="" 
                loading="lazy" 
                referrerpolicy="no-referrer-when-downgrade">
            </iframe>
        `;
    }
    
    // Calculate distance between two points
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;
        
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c; // Distance in meters
    }
    
    // Check if user is at construction site
    checkSiteProximity(siteLatitude, siteLongitude, maxDistance = 100) {
        return new Promise((resolve, reject) => {
            this.getCurrentPosition()
                .then(position => {
                    const distance = this.calculateDistance(
                        position.coords.latitude,
                        position.coords.longitude,
                        siteLatitude,
                        siteLongitude
                    );
                    
                    resolve({
                        distance: distance,
                        isAtSite: distance <= maxDistance,
                        accuracy: position.coords.accuracy
                    });
                })
                .catch(reject);
        });
    }
    
    // Get address from coordinates (reverse geocoding)
    async getAddressFromCoordinates(latitude, longitude) {
        try {
            // Using Nominatim OpenStreetMap API for reverse geocoding
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'ELP-Obras-App/1.0'
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error('Geocoding service unavailable');
            }
            
            const data = await response.json();
            
            if (data && data.display_name) {
                // Extract meaningful parts of the address
                const address = data.address || {};
                let formattedAddress = '';
                
                if (address.road) {
                    formattedAddress += address.road;
                    if (address.house_number) {
                        formattedAddress += ', ' + address.house_number;
                    }
                }
                
                if (address.suburb || address.neighbourhood) {
                    formattedAddress += formattedAddress ? ' - ' : '';
                    formattedAddress += (address.suburb || address.neighbourhood);
                }
                
                if (address.city || address.town || address.village) {
                    formattedAddress += formattedAddress ? ', ' : '';
                    formattedAddress += (address.city || address.town || address.village);
                }
                
                if (address.state) {
                    formattedAddress += formattedAddress ? ', ' : '';
                    formattedAddress += address.state;
                }
                
                return formattedAddress || data.display_name;
            }
            
            return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            
        } catch (error) {
            console.error('Error getting address:', error);
            return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        }
    }
    
    // Save location to local storage
    saveLocationToStorage(key, position) {
        try {
            const locationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
            };
            
            localStorage.setItem(`elp_location_${key}`, JSON.stringify(locationData));
        } catch (error) {
            console.error('Error saving location to storage:', error);
        }
    }
    
    // Load location from local storage
    loadLocationFromStorage(key) {
        try {
            const stored = localStorage.getItem(`elp_location_${key}`);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Error loading location from storage:', error);
            return null;
        }
    }
}

// Global function to get current location (used by templates)
function getCurrentLocation() {
    GeoLocation.getCurrentPosition()
        .then(position => {
            console.log('Location obtained:', position);
        })
        .catch(error => {
            console.error('Error getting location:', error);
        });
}

// Initialize Geolocation Manager
const GeoLocation = new GeolocationManager();

// Make geolocation manager globally available
window.GeoLocation = GeoLocation;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeolocationManager;
}
