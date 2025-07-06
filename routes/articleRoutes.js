import express from 'express';
import { auth, requireAdmin } from '../middleware/auth.js';
import {
  getArticles,
  getArticleBySlug,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle
} from '../controllers/articleController.js';

const router = express.Router();

// Routes publiques
router.get('/', getArticles);
router.get('/slug/:slug', getArticleBySlug);
router.get('/:identifier', getArticle);

// Routes protégées (Admin seulement)
router.post('/', auth, requireAdmin, createArticle);
router.put('/:id', auth, requireAdmin, updateArticle);
router.delete('/:id', auth, requireAdmin, deleteArticle);

export default router; 