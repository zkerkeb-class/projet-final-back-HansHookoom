import express from 'express';
import { auth, requireAdmin } from '../middleware/auth.js';
import {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview
} from '../controllers/reviewController.js';

const router = express.Router();

// Routes publiques
router.get('/', getReviews);
router.get('/:identifier', getReview);

// Routes protégées (Admin seulement)
router.post('/', auth, requireAdmin, createReview);
router.put('/:id', auth, requireAdmin, updateReview);
router.delete('/:id', auth, requireAdmin, deleteReview);

export default router; 