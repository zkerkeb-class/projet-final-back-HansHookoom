import express from 'express';
import { auth } from '../middleware/auth.js';
import {
  register,
  login,
  getProfile,
  updateProfile,
  deleteAccount
} from '../controllers/authController.js';

const router = express.Router();

// Routes publiques
router.post('/register', register);
router.post('/login', login);

// Routes protégées
router.get('/me', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.delete('/delete-account', auth, deleteAccount);

export default router; 