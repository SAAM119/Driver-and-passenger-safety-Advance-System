import express from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

export default (firebaseService) => {
  // Get system status
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const status = await firebaseService.getSystemStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update system status (admin only)
  router.put('/', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      // Validate status value
      const validStatuses = ['operational', 'degraded', 'maintenance', 'outage'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: 'Invalid status. Must be one of: operational, degraded, maintenance, outage' 
        });
      }

      await firebaseService.updateSystemStatus(status);
      
      // Add log entry for status update
      await firebaseService.addLog(
        'SYSTEM',
        'STATUS_UPDATED',
        `System status updated to: ${status}`
      );
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get system health metrics
  router.get('/health', authMiddleware, async (req, res) => {
    try {
      // Get various system metrics
      const [
        status,
        vehicleCount,
        activeSOSCount,
        recentLogs
      ] = await Promise.all([
        firebaseService.getSystemStatus(),
        firebaseService.getVehicleCount(),
        firebaseService.getActiveSOSCount(),
        firebaseService.getLogs(10)
      ]);

      res.json({
        status: status.status,
        metrics: {
          vehicleCount,
          activeSOSCount,
          recentLogs,
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Report system issue (admin only)
  router.post('/issues', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
      const { type, description } = req.body;
      if (!type || !description) {
        return res.status(400).json({ error: 'Type and description are required' });
      }

      // Add log entry for system issue
      await firebaseService.addLog(
        'SYSTEM',
        'ISSUE_REPORTED',
        `System issue reported - Type: ${type}, Description: ${description}`
      );

      // If issue is critical, update system status
      if (type === 'critical') {
        await firebaseService.updateSystemStatus('degraded');
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}; 