import express from 'express';
import cors from 'cors';
import 'dotenv/config';

// Importation de la configuration de base de données
import { connectDB } from './config/database.js';

// Importation des routes
import authRoutes from './routes/authRoutes.js';
import articleRoutes from './routes/articleRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import likeRoutes from './routes/likeRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import commentRoutes from './routes/commentRoutes.js';

// Vérification des variables d'environnement
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // console.error('❌ JWT_SECRET manquant dans les variables d\'environnement !');
  process.exit(1);
}

const app = express();

// Middleware globaux
app.use(cors());
app.use(express.json());

// Connexion à la base de données
connectDB();

// Routes API
app.use('/api/auth', authRoutes);
app.use('/articles', articleRoutes);
app.use('/reviews', reviewRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/comments', commentRoutes);

// Middleware de gestion d'erreurs global
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(err.status || 500).json({
    message: err.message || 'Erreur interne du serveur',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Gestion des routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} non trouvée`,
    error: 'Endpoint non disponible'
  });
});

export default app; 