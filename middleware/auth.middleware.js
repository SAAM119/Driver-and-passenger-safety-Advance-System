import { getAuth } from 'firebase/auth';
import { getDatabase, ref, get } from 'firebase/database';

export const authMiddleware = async (req, res, next) => {
  try {
    const auth = getAuth();
    const authHeader = req.headers.authorization;

    // Allow anonymous access for ESP32 devices
    const isEsp32Request = req.headers['x-device-type'] === 'esp32';
    if (isEsp32Request) {
      req.user = { isEsp32: true };
      return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    try {
      // For development, allow all authenticated requests
      req.user = { uid: 'esp32-service-worker', admin: true };
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

export const adminMiddleware = async (req, res, next) => {
  try {
    // Allow ESP32 devices full access
    if (req.user && (req.user.isEsp32 || req.user.admin)) {
      return next();
    }

    return res.status(403).json({ error: 'Admin access required' });
  } catch (error) {
    return res.status(500).json({ error: 'Authorization failed' });
  }
}; 