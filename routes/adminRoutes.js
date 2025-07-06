import express from 'express';
import { auth, requireAdmin } from '../middleware/auth.js';
import {
  getUsers,
  promoteUser,
  createFirstAdmin,
  deleteUser,
  cleanupOrphanedLikes,
  getDiagnostic,
  syncCounters
} from '../controllers/adminController.js';

// Import des statistiques de likes depuis le contrôleur des likes
import { getLikesStats, getContentLikes } from '../controllers/likeController.js';

const router = express.Router();

// Route publique pour créer le premier admin (pas de middleware)
router.post('/create-first-admin', createFirstAdmin);

// Routes d'administration (nécessitent le rôle admin)
router.get('/users', auth, requireAdmin, getUsers);
router.post('/promote-user', auth, requireAdmin, promoteUser);
router.delete('/users/:userId', auth, requireAdmin, deleteUser);

// Routes de maintenance des likes (admin)
router.get('/likes/stats', auth, requireAdmin, getLikesStats);
router.get('/likes/:contentType/:contentId', auth, requireAdmin, getContentLikes);
router.post('/cleanup-orphaned-likes', auth, requireAdmin, cleanupOrphanedLikes);
router.get('/likes/diagnostic', auth, requireAdmin, getDiagnostic);
router.post('/likes/sync-counters', auth, requireAdmin, syncCounters);

export default router; 