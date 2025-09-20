import express from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

export default (firebaseService) => {
  // Get all emergency contacts
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const contacts = await firebaseService.getEmergencyContacts();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update emergency contact (admin only)
  router.put('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
      const { name, number, type } = req.body;
      if (!name || !number || !type) {
        return res.status(400).json({ error: 'Name, number, and type are required' });
      }
      
      await firebaseService.updateEmergencyContact(req.params.id, {
        name,
        number,
        type
      });
      
      // Add log entry for contact update
      await firebaseService.addLog(
        'SYSTEM',
        'CONTACT_UPDATED',
        `Emergency contact ${req.params.id} updated`
      );
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add new emergency contact (admin only)
  router.post('/', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
      const { id, name, number, type } = req.body;
      if (!id || !name || !number || !type) {
        return res.status(400).json({ error: 'ID, name, number, and type are required' });
      }
      
      await firebaseService.updateEmergencyContact(id, {
        name,
        number,
        type
      });
      
      // Add log entry for new contact
      await firebaseService.addLog(
        'SYSTEM',
        'CONTACT_ADDED',
        `New emergency contact added: ${id}`
      );
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete emergency contact (admin only)
  router.delete('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
      await firebaseService.deleteEmergencyContact(req.params.id);
      
      // Add log entry for contact deletion
      await firebaseService.addLog(
        'SYSTEM',
        'CONTACT_DELETED',
        `Emergency contact deleted: ${req.params.id}`
      );
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}; 