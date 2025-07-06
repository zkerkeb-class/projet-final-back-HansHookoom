import express from 'express';
import { auth, requireAdmin } from '../middleware/auth.js';
import {
  upload,
  uploadImage,
  getImage,
  getImages,
  deleteImage,
  handleMulterError
} from '../controllers/imageController.js';

const router = express.Router();

// Route publique - Récupérer une image par ID
router.get('/:id', getImage);

// Routes protégées (Admin seulement)
router.post('/upload', auth, requireAdmin, upload, handleMulterError, uploadImage);
router.get('/', auth, requireAdmin, getImages);
router.delete('/:id', auth, requireAdmin, deleteImage);

export default router; 