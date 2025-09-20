import express from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

export default (firebaseService) => {
  // Get all logs with pagination and filtering
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const { 
        limit = 100,
        offset = 0,
        type,
        vehicleId,
        startDate,
        endDate
      } = req.query;

      const filters = {
        type,
        vehicleId,
        startDate,
        endDate
      };

      const logs = await firebaseService.getLogs(
        parseInt(limit),
        parseInt(offset),
        filters
      );

      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get logs for specific vehicle
  router.get('/vehicle/:id', authMiddleware, async (req, res) => {
    try {
      const { limit = 100 } = req.query;
      const logs = await firebaseService.getLogs(parseInt(limit), 0, {
        vehicleId: req.params.id
      });
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get system logs (admin only)
  router.get('/system', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
      const { limit = 100 } = req.query;
      const logs = await firebaseService.getLogs(parseInt(limit), 0, {
        type: 'SYSTEM'
      });
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add new log entry
  router.post('/', authMiddleware, async (req, res) => {
    try {
      const { vehicleId, event, details } = req.body;
      if (!vehicleId || !event) {
        return res.status(400).json({ error: 'Vehicle ID and event are required' });
      }

      await firebaseService.addLog(vehicleId, event, details || '');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get log statistics (admin only)
  router.get('/stats', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      const stats = await firebaseService.getLogStats(startDate, endDate);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Clear old logs (admin only)
  router.delete('/cleanup', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
      const { olderThan } = req.query;
      
      if (!olderThan) {
        return res.status(400).json({ error: 'olderThan date parameter is required' });
      }

      const deletedCount = await firebaseService.clearOldLogs(olderThan);
      
      // Log the cleanup action
      await firebaseService.addLog(
        'SYSTEM',
        'LOGS_CLEANED',
        `Deleted ${deletedCount} logs older than ${olderThan}`
      );

      res.json({ success: true, deletedCount });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}; 