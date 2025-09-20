import { getDatabase, ref, onValue, set, get, update, remove } from 'firebase/database';
import { getAuth, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';

class FirebaseService {
  constructor(app) {
    try {
      this.database = getDatabase(app);
      this.auth = getAuth(app);
      // Enable local persistence and offline capabilities
      setPersistence(this.auth, browserLocalPersistence)
        .then(() => {
          console.log('Firebase persistence enabled');
        })
        .catch((error) => {
          console.warn('Firebase persistence setup failed:', error);
        });

      // Set up database reference with auth override
      this.database.ref = (path) => ref(this.database, path);
      
      console.log('Firebase service initialized with database and auth');
    } catch (error) {
      console.error('Error initializing Firebase service:', error);
      throw error;
    }
  }

  // Authentication methods
  async login(email, password) {
    try {
      // Special handling for ESP32 device
      if (email === 'esp32@device.com') {
        console.log('ESP32 device authentication attempt');
        // Add custom auth header for ESP32
        this.database.app.options.headers = {
          ...this.database.app.options.headers,
          'X-Device-Type': 'esp32'
        };
      }
      
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      console.log('Login successful for:', email);
      
      // Set up database rules after successful login
      await this.setupDatabaseRules();
      
      return userCredential.user;
    } catch (error) {
      console.error('Authentication error:', error.code, error.message);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  // Set up database rules after authentication
  async setupDatabaseRules() {
    try {
      const rulesRef = ref(this.database, '.settings');
      const rules = {
        rules: {
          ".read": "auth != null",
          ".write": "auth != null",
          "vehicles": {
            "$vehicleId": {
              ".read": true,
              ".write": true,
              ".validate": "newData.hasChildren(['latitude', 'longitude'])"
            }
          },
          "sos": {
            "$vehicleId": {
              ".read": true,
              ".write": true,
              ".validate": "newData.hasChildren(['vehicleId', 'timestamp'])"
            }
          },
          "logs": {
            "$logId": {
              ".read": true,
              ".write": true,
              ".validate": "newData.hasChildren(['vehicleId', 'event', 'timestamp'])"
            }
          }
        }
      };

      await set(rulesRef, rules);
      console.log('Database rules updated successfully');
    } catch (error) {
      console.warn('Failed to update database rules:', error);
      // Continue anyway as rules might be set in Firebase Console
    }
  }

  async logout() {
    try {
      await signOut(this.auth);
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  // Vehicle methods with enhanced error handling
  async getVehicle(vehicleId) {
    try {
      const vehicleRef = ref(this.database, `vehicles/${vehicleId}`);
      const snapshot = await get(vehicleRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('Get vehicle error:', error);
      throw new Error(`Failed to get vehicle: ${error.message}`);
    }
  }

  async updateVehicleLocation(vehicleId, latitude, longitude) {
    try {
      const vehicleRef = ref(this.database, `vehicles/${vehicleId}`);
      const snapshot = await get(vehicleRef);
      const existingData = snapshot.exists() ? snapshot.val() : {};
      
      const updateData = {
        ...existingData,
        id: vehicleId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        lastUpdate: new Date().toISOString(),
        isActive: true,
        isWifiConnected: true,
        isFirebaseConnected: true,
        sos: existingData.sos || false
      };

      await set(vehicleRef, updateData);
      console.log('Vehicle location updated:', vehicleId, updateData);
      return true;
    } catch (error) {
      console.error('Update location error:', error);
      throw new Error(`Failed to update vehicle location: ${error.message}`);
    }
  }

  // Enhanced error handling for SOS operations
  async triggerSOS(vehicleId) {
    try {
      const vehicleRef = ref(this.database, `vehicles/${vehicleId}`);
      const snapshot = await get(vehicleRef);
      const vehicleData = snapshot.exists() ? snapshot.val() : {};
      
      const updateData = {
        ...vehicleData,
        id: vehicleId,
        sos: true,
        sosTimestamp: new Date().toISOString(),
        isActive: true
      };

      await set(vehicleRef, updateData);
      
      // Create SOS entry
      const sosRef = ref(this.database, `sos/${vehicleId}`);
      await set(sosRef, {
        vehicleId,
        latitude: parseFloat(vehicleData.latitude) || 0,
        longitude: parseFloat(vehicleData.longitude) || 0,
        timestamp: new Date().toISOString(),
        active: true
      });

      console.log('SOS triggered for vehicle:', vehicleId);
      return true;
    } catch (error) {
      console.error('Trigger SOS error:', error);
      throw new Error(`Failed to trigger SOS: ${error.message}`);
    }
  }

  async clearSOS(vehicleId) {
    try {
      const vehicleRef = ref(this.database, `vehicles/${vehicleId}`);
      const snapshot = await get(vehicleRef);
      const vehicleData = snapshot.exists() ? snapshot.val() : {};
      
      const updateData = {
        ...vehicleData,
        sos: false,
        sosClearedTimestamp: new Date().toISOString()
      };

      await set(vehicleRef, updateData);
      
      // Remove SOS entry
      const sosRef = ref(this.database, `sos/${vehicleId}`);
      await remove(sosRef);

      console.log('SOS cleared for vehicle:', vehicleId);
      return true;
    } catch (error) {
      console.error('Clear SOS error:', error);
      throw new Error(`Failed to clear SOS: ${error.message}`);
    }
  }

  // Log methods
  async addLog(vehicleId, event, details) {
    try {
      // Create a valid Firebase key by replacing invalid characters
      const timestamp = new Date().toISOString()
        .replace(/\./g, '_')
        .replace(/:/g, '-')
        .replace(/[[\]#$]/g, '_');
      
      const logRef = ref(this.database, `logs/${timestamp}`);
      await set(logRef, {
        vehicleId,
        event,
        details,
        timestamp: new Date().toISOString() // Keep the original timestamp in the data
      });
      console.log('Log added successfully:', { vehicleId, event });
      return true;
    } catch (error) {
      console.error('Error adding log:', error);
      throw new Error(`Failed to add log: ${error.message}`);
    }
  }

  async getLogs(limit = 100) {
    try {
      const logsRef = ref(this.database, 'logs');
      const snapshot = await get(logsRef);
      if (!snapshot.exists()) return [];
      
      const logs = Object.entries(snapshot.val())
        .map(([key, value]) => ({
          id: key,
          ...value,
          timestamp: value.timestamp // Use the original timestamp from the data
        }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
      
      return logs;
    } catch (error) {
      console.error('Error getting logs:', error);
      throw new Error(`Failed to get logs: ${error.message}`);
    }
  }

  // Emergency contact methods
  async getEmergencyContacts() {
    try {
      const contactsRef = ref(this.database, 'emergency-contacts');
      const snapshot = await get(contactsRef);
      return snapshot.exists() ? snapshot.val() : {};
    } catch (error) {
      throw new Error(`Failed to get emergency contacts: ${error.message}`);
    }
  }

  async updateEmergencyContact(contactId, data) {
    try {
      const contactRef = ref(this.database, `emergency-contacts/${contactId}`);
      await update(contactRef, {
        ...data,
        lastUpdated: new Date().toISOString()
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to update emergency contact: ${error.message}`);
    }
  }

  // System status methods
  async getSystemStatus() {
    try {
      const statusRef = ref(this.database, 'system-status');
      const snapshot = await get(statusRef);
      return snapshot.exists() ? snapshot.val() : { status: 'operational' };
    } catch (error) {
      console.error('Get system status error:', error);
      throw new Error(`Failed to get system status: ${error.message}`);
    }
  }

  async updateSystemStatus(status) {
    try {
      const statusRef = ref(this.database, 'system-status');
      await update(statusRef, {
        status,
        lastUpdated: new Date().toISOString()
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to update system status: ${error.message}`);
    }
  }

  // Get all vehicles
  async getVehicles() {
    try {
      const vehiclesRef = ref(this.database, 'vehicles');
      const snapshot = await get(vehiclesRef);
      if (snapshot.exists()) {
        const vehicles = snapshot.val();
        // Format vehicle data
        const formattedVehicles = {};
        Object.entries(vehicles).forEach(([id, data]) => {
          formattedVehicles[id] = {
            ...data,
            latitude: parseFloat(data.latitude) || 0,
            longitude: parseFloat(data.longitude) || 0,
            sos: Boolean(data.sos),
            lastUpdate: data.lastUpdate || new Date().toISOString(),
            isActive: true
          };
        });
        return formattedVehicles;
      }
      return {};
    } catch (error) {
      console.error('Get vehicles error:', error);
      throw new Error(`Failed to get vehicles: ${error.message}`);
    }
  }

  // Watch vehicle updates
  watchVehicles(callback) {
    try {
      const vehiclesRef = ref(this.database, 'vehicles');
      
      // Set up error recovery
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 5000; // 5 seconds
      
      const unsubscribe = onValue(vehiclesRef, (snapshot) => {
        if (snapshot.exists()) {
          const vehicles = snapshot.val();
          // Format vehicle data
          const formattedVehicles = {};
          Object.entries(vehicles).forEach(([id, data]) => {
            formattedVehicles[id] = {
              ...data,
              id,
              latitude: parseFloat(data.latitude) || 0,
              longitude: parseFloat(data.longitude) || 0,
              sos: Boolean(data.sos),
              lastUpdate: data.lastUpdate || new Date().toISOString(),
              isActive: true,
              isWifiConnected: true,
              isFirebaseConnected: true
            };
          });
          console.log('Formatted vehicle data:', formattedVehicles);
          callback(null, formattedVehicles);
          retryCount = 0; // Reset retry count on successful update
        } else {
          console.log('No vehicles data available');
          callback(null, {});
        }
      }, (error) => {
        console.error('Watch vehicles error:', error);
        
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying connection (${retryCount}/${maxRetries}) in ${retryDelay/1000}s...`);
          setTimeout(() => {
            this.watchVehicles(callback);
          }, retryDelay);
        } else {
          callback(error, null);
        }
      });

      return unsubscribe;
    } catch (error) {
      console.error('Watch vehicles setup error:', error);
      callback(error, null);
    }
  }

  // Watch specific vehicle
  watchVehicle(vehicleId, callback) {
    try {
      const vehicleRef = ref(this.database, `vehicles/${vehicleId}`);
      
      return onValue(vehicleRef, (snapshot) => {
        const vehicle = snapshot.exists() ? snapshot.val() : null;
        if (vehicle) {
          console.log(`Vehicle ${vehicleId} update:`, vehicle);
          // Ensure SOS status is properly set
          if (vehicle.sos === undefined) {
            vehicle.sos = false;
          }
          callback(null, vehicle);
        } else {
          console.log(`No data available for vehicle ${vehicleId}`);
          callback(null, null);
        }
      }, (error) => {
        console.error(`Watch vehicle ${vehicleId} error:`, error);
        callback(error, null);
      });
    } catch (error) {
      console.error(`Watch vehicle ${vehicleId} setup error:`, error);
      callback(error, null);
    }
  }

  // New methods
  async setSosStatus(vehicleId, status) {
    const sosRef = ref(this.database, `sos/${vehicleId}`);
    await set(sosRef, status);
  }

  // Add default headers for all requests
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'X-Device-Type': 'web'
    };
    if (this.auth.currentUser) {
      headers['Authorization'] = `Bearer ${this.auth.currentUser.getIdToken()}`;
    }
    return headers;
  }
}

export default FirebaseService; 