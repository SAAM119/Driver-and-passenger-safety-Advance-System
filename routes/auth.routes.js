import express from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

export default (firebaseService) => {
  // Login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await firebaseService.login(email, password);
      
      // Add log entry for successful login
      await firebaseService.addLog(
        'SYSTEM',
        'USER_LOGIN',
        `User logged in: ${email}`
      );

      res.json({
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          isAdmin: user.customClaims?.admin || false
        },
        token: await user.getIdToken()
      });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });

  // Logout
  router.post('/logout', authMiddleware, async (req, res) => {
    try {
      await firebaseService.logout();
      
      // Add log entry for logout
      await firebaseService.addLog(
        'SYSTEM',
        'USER_LOGOUT',
        `User logged out: ${req.user.email}`
      );

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get current user
  router.get('/me', authMiddleware, async (req, res) => {
    try {
      const user = await firebaseService.getCurrentUser();
      res.json({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        isAdmin: user.customClaims?.admin || false
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Change password
  router.post('/change-password', authMiddleware, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      await firebaseService.changePassword(currentPassword, newPassword);
      
      // Add log entry for password change
      await firebaseService.addLog(
        'SYSTEM',
        'PASSWORD_CHANGED',
        `Password changed for user: ${req.user.email}`
      );

      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Reset password request
  router.post('/reset-password', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      await firebaseService.sendPasswordResetEmail(email);
      
      // Add log entry for password reset request
      await firebaseService.addLog(
        'SYSTEM',
        'PASSWORD_RESET_REQUESTED',
        `Password reset requested for: ${email}`
      );

      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update user profile (admin only)
  router.put('/users/:uid', [authMiddleware, adminMiddleware], async (req, res) => {
    try {
      const { displayName, isAdmin } = req.body;
      
      await firebaseService.updateUserProfile(req.params.uid, {
        displayName,
        isAdmin
      });
      
      // Add log entry for profile update
      await firebaseService.addLog(
        'SYSTEM',
        'USER_UPDATED',
        `User profile updated: ${req.params.uid}`
      );

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}; 