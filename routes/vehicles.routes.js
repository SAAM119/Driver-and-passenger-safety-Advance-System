import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

export default (firebaseService) => {
  // Get all vehicles
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const vehicles = await firebaseService.getVehicles();
      res.json(vehicles);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get specific vehicle
  router.get('/:id', authMiddleware, async (req, res) => {
    try {
      const vehicle = await firebaseService.getVehicle(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }
      res.json(vehicle);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update vehicle location
  router.post('/:id/location', authMiddleware, async (req, res) => {
    try {
      const { latitude, longitude } = req.body;
      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
      }
      await firebaseService.updateVehicleLocation(req.params.id, latitude, longitude);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Trigger SOS
  router.post('/:id/sos', authMiddleware, async (req, res) => {
    try {
      await firebaseService.triggerSOS(req.params.id);
      // Add log entry for SOS trigger
      await firebaseService.addLog(req.params.id, 'SOS_TRIGGERED', 'Emergency alert activated');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Clear SOS
  router.post('/:id/clear-sos', authMiddleware, async (req, res) => {
    try {
      await firebaseService.clearSOS(req.params.id);
      // Add log entry for SOS clear
      await firebaseService.addLog(req.params.id, 'SOS_CLEARED', 'Emergency alert cleared');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}; 