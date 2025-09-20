# SafeGuard Emergency Dashboard Backend

This is the backend service for the SafeGuard Emergency Dashboard, built with Node.js and Firebase.

## Features

- Real-time vehicle tracking
- SOS alert management
- Emergency contact management
- System status monitoring
- Authentication and authorization
- Logging system

## Prerequisites

- Node.js 14.x or higher
- npm 6.x or higher
- Firebase account with Realtime Database enabled

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd safeguard-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Firebase configuration:
```env
PORT=3000
```

4. Start the server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email and password
- `POST /api/auth/logout` - Logout current user

### Vehicles
- `GET /api/vehicles` - Get all vehicles
- `GET /api/vehicles/:id` - Get specific vehicle
- `POST /api/vehicles/:id/location` - Update vehicle location
- `POST /api/vehicles/:id/sos` - Trigger SOS alert
- `POST /api/vehicles/:id/clear-sos` - Clear SOS alert

### Emergency Contacts
- `GET /api/emergency-contacts` - Get all emergency contacts
- `PUT /api/emergency-contacts/:id` - Update emergency contact

### System Status
- `GET /api/system-status` - Get system status
- `PUT /api/system-status` - Update system status

### Logs
- `GET /api/logs` - Get system logs
- `POST /api/logs` - Add new log entry

## Firebase Database Structure

```json
{
  "vehicles": {
    "vehicleId": {
      "latitude": number,
      "longitude": number,
      "sos": boolean,
      "sosTimestamp": string,
      "lastUpdated": string
    }
  },
  "emergency-contacts": {
    "contactId": {
      "name": string,
      "number": string,
      "type": string,
      "lastUpdated": string
    }
  },
  "system-status": {
    "status": string,
    "lastUpdated": string
  },
  "logs": {
    "timestamp": {
      "vehicleId": string,
      "event": string,
      "details": string,
      "timestamp": string
    }
  }
}
```

## Security Rules

Add these security rules to your Firebase Realtime Database:

```json
{
  "rules": {
    ".read": true,
    ".write": true,
    "vehicles": {
      "$vehicleId": {
        ".read": true,
        ".write": true,
        ".validate": true
      }
    },
    "sos": {
      "$vehicleId": {
        ".read": true,
        ".write": true,
        ".validate": true
      }
    },
    "test": {
      "$vehicleId": {
        ".read": true,
        ".write": true,
        ".validate": true
      }
    }
  }
}
```

These rules allow:
1. Anonymous access to all data (for development purposes)
2. Full access to vehicle and SOS data
3. Test data access for connection testing

⚠️ **Important Security Note**: These rules are for development/testing only. For production, implement proper authentication rules.

To update these rules:
1. Go to Firebase Console (https://console.firebase.google.com)
2. Select project "technomax-2k25"
3. Go to Realtime Database
4. Click on "Rules" tab
5. Replace the existing rules with the above rules
6. Click "Publish"

## Error Handling

The API uses standard HTTP status codes:
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License. 