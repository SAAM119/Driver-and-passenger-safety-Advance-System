import express from 'express';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get } from 'firebase/database';
import dotenv from 'dotenv';
import { firebaseConfig, databaseRules } from './config/firebase.config.js';
import FirebaseService from './services/firebase.service.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import http from 'http';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import vehiclesRoutes from './routes/vehicles.routes.js';
import emergencyContactsRoutes from './routes/emergency-contacts.routes.js';
import systemStatusRoutes from './routes/system-status.routes.js';
import logsRoutes from './routes/logs.routes.js';
import authRoutes from './routes/auth.routes.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3003;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Device-Type"]
    }
});

// Middleware
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Device-Type"]
}));
app.use(express.json());
app.use(express.static(__dirname));

// Initialize Firebase
let firebaseService;
let database;

async function initializeFirebase() {
    try {
        console.log('Initializing Firebase with config:', {
            projectId: firebaseConfig.projectId,
            databaseURL: firebaseConfig.databaseURL,
            authDomain: firebaseConfig.authDomain
        });
        
        const firebaseApp = initializeApp(firebaseConfig);
        database = getDatabase(firebaseApp);
        firebaseService = new FirebaseService(firebaseApp);

        // Authenticate first
        await firebaseService.login('esp32@device.com', 'esp32password123');
        console.log('Firebase authentication successful');

        // Set initial data structure
        try {
            const vehiclesRef = ref(database, 'vehicles');
            const sosRef = ref(database, 'sos');
            const logsRef = ref(database, 'logs');

            // Initialize base paths with default values if they don't exist
            const vehiclesSnapshot = await get(vehiclesRef);
            if (!vehiclesSnapshot.exists()) {
                await set(vehiclesRef, {});
            }

            const sosSnapshot = await get(sosRef);
            if (!sosSnapshot.exists()) {
                await set(sosRef, {});
            }

            const logsSnapshot = await get(logsRef);
            if (!logsSnapshot.exists()) {
                await set(logsRef, {});
            }

            console.log('Database structure initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize database structure:', error);
            return false;
        }
    } catch (error) {
        console.error('Firebase initialization error:', error);
        return false;
    }
}

// Initialize test data
async function initializeTestData() {
    try {
        const user = await firebaseService.login('esp32@device.com', 'esp32password123');
        console.log('Successfully authenticated with Firebase:', user.email);

        const testVehicle = {
            id: 'ESP32_1',
            latitude: 29.904322,
            longitude: 77.839668,
            lastUpdate: new Date().toISOString(),
            sos: false,
            isWifiConnected: true,
            isFirebaseConnected: true,
            isActive: true
        };

        // Update vehicle data in Firebase
        const vehicleRef = database.ref(`vehicles/${testVehicle.id}`);
        await set(vehicleRef, testVehicle);
        
        console.log('Test data initialized');
        console.log('Vehicles updated:', testVehicle.id);
        return true;
    } catch (error) {
        console.error('Error initializing test data:', error);
        return false;
    }
}

// Socket.IO connection handling
function setupSocketIO() {
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        // Handle initial vehicle data request
        socket.on('getVehicles', async () => {
            try {
                const vehicles = await firebaseService.getVehicles();
                socket.emit('vehicleUpdates', vehicles);
            } catch (error) {
                console.error('Error fetching initial vehicle data:', error);
                socket.emit('error', { message: 'Failed to fetch vehicle data' });
            }
        });

        // Watch for vehicle updates with error recovery
        let watchUnsubscribe;
        try {
            watchUnsubscribe = firebaseService.watchVehicles((error, vehicles) => {
                if (error) {
                    console.error('Error watching vehicles:', error);
                    socket.emit('error', { message: 'Vehicle update error' });
                    return;
                }
                if (vehicles) {
                    console.log('Broadcasting vehicle updates:', vehicles);
                    io.emit('vehicleUpdates', vehicles);
                }
            });
        } catch (error) {
            console.error('Failed to set up vehicle watch:', error);
        }

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            if (watchUnsubscribe) {
                watchUnsubscribe();
            }
        });
    });
}

// Start server
async function startServer() {
    if (await initializeFirebase()) {
        // Set up routes
        app.use('/api/auth', authRoutes(firebaseService));
        app.use('/api/vehicles', vehiclesRoutes(firebaseService));
        app.use('/api/emergency-contacts', emergencyContactsRoutes(firebaseService));
        app.use('/api/system-status', systemStatusRoutes(firebaseService));
        app.use('/api/logs', logsRoutes(firebaseService));

        // Root route
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'web.html'));
        });

        // Error handling middleware
        app.use((err, req, res, next) => {
            console.error('Server error:', err);
            res.status(500).json({
                error: 'Internal Server Error',
                message: err.message
            });
        });

        // Health check endpoint
        app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                firebase: firebaseService ? 'initialized' : 'not initialized'
            });
        });

        // Set up Socket.IO
        setupSocketIO();

        // Start the server
        server.listen(port, async () => {
            console.log(`Server running on port ${port}`);
            await initializeTestData();
        });
    } else {
        console.error('Failed to initialize Firebase. Exiting...');
        process.exit(1);
    }
}

// Start the application
startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
}); 