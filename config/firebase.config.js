import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBmPMhCALgtoNXfb6fPSu95PdryCWpr7Dw",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "technomax-2k25.firebaseapp.com",
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://technomax-2k25-default-rtdb.firebaseio.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "technomax-2k25",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "technomax-2k25.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "681549172524",
  appId: process.env.FIREBASE_APP_ID || "1:681549172524:web:aa4b1fdd0a812995bfa689",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-FN7BZW6Q8J",
  databaseAuthVariableOverride: {
    uid: "esp32-service-worker",
    admin: true,
    provider: "custom",
    token: "development-token"
  }
};

// Database rules (these need to be set in Firebase Console)
const databaseRules = {
  "rules": {
    ".read": true,
    ".write": true,
    "vehicles": {
      ".read": true,
      ".write": true,
      "$vehicleId": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['latitude', 'longitude'])"
      }
    },
    "sos": {
      ".read": true,
      ".write": true,
      "$vehicleId": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['vehicleId', 'timestamp'])"
      }
    },
    "logs": {
      ".read": true,
      ".write": true,
      "$logId": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['vehicleId', 'event', 'timestamp'])"
      }
    },
    "test": {
      ".read": true,
      ".write": true
    }
  }
};

console.log('Using Firebase configuration:', {
  projectId: firebaseConfig.projectId,
  databaseURL: firebaseConfig.databaseURL,
  authDomain: firebaseConfig.authDomain
});

export { firebaseConfig, databaseRules }; 