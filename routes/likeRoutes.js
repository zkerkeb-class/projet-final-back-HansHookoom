import express from 'express';
import { auth, requireAdmin } from '../middleware/auth.js';
import {
  toggleLike,
  getLikeStatus
} from '../controllers/likeController.js';

const router = express.Router();

// Routes publiques (nécessitent l'authentification)
router.post('/:contentType/:contentId', auth, toggleLike);
router.get('/:contentType/:contentId', auth, getLikeStatus);

export default router; 