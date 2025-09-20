// API Configuration
const API_BASE_URL = 'http://localhost:3002/api';
let authToken = null;

// API Service
const api = {
    // Auth endpoints
    async login(email, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-Type': 'web'
                },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Authentication failed');
            }
            authToken = data.token;
            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    // Add default headers for all requests
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'X-Device-Type': 'web'
        };
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        return headers;
    },

    async logout() {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: this.getHeaders()
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            authToken = null;
            return data;
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    },

    // Vehicle endpoints with updated headers
    async getVehicles() {
        try {
            const response = await fetch(`${API_BASE_URL}/vehicles`, {
                headers: this.getHeaders()
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            return data;
        } catch (error) {
            console.error('Error fetching vehicles:', error);
            throw error;
        }
    },

    async updateVehicleLocation(vehicleId, latitude, longitude) {
        const response = await fetch(`${API_BASE_URL}/vehicles/${vehicleId}/location`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ latitude, longitude })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
    },

    async triggerSOS(vehicleId) {
        const response = await fetch(`${API_BASE_URL}/vehicles/${vehicleId}/sos`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
    },

    async clearSOS(vehicleId) {
        const response = await fetch(`${API_BASE_URL}/vehicles/${vehicleId}/clear-sos`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
    },

    // Emergency contacts endpoints
    async getEmergencyContacts() {
        const response = await fetch(`${API_BASE_URL}/emergency-contacts`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
    },

    // System status endpoints
    async getSystemStatus() {
        const response = await fetch(`${API_BASE_URL}/system-status`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
    },

    // Logs endpoints
    async getLogs(limit = 100) {
        const response = await fetch(`${API_BASE_URL}/logs?limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
    }
};

export default api; 