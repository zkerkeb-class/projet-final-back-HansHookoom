import express from 'express';
import { auth, optionalAuth } from '../middleware/auth.js';
import {
  getArticleComments,
  getReviewComments,
  createComment,
  deleteComment,
  forceDeleteComment
} from '../controllers/commentController.js';
import { toggleLike } from '../controllers/likeController.js';

const router = express.Router();

// Routes pour récupérer les commentaires (public avec auth optionnelle)
router.get('/news/:articleId', optionalAuth, getArticleComments);
router.get('/review/:reviewId', optionalAuth, getReviewComments);

// Routes pour créer et supprimer des commentaires (authentification requise)
router.post('/', auth, createComment);
router.delete('/:commentId', auth, deleteComment);
router.delete('/:commentId/force', auth, forceDeleteComment);

// Route pour liker/unliker un commentaire (authentification requise)
router.post('/:commentId/like', auth, (req, res, next) => {
  // Transformer les paramètres pour correspondre au contrôleur de likes
  req.params.contentType = 'comment';
  req.params.contentId = req.params.commentId;
  next();
}, toggleLike);

export default router; 