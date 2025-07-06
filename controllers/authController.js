import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Joi from 'joi';

const JWT_SECRET = process.env.JWT_SECRET;

// Schémas Joi
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(128).required(),
  username: Joi.string().min(2).max(50).optional()
});
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(128).required()
});
const updateProfileSchema = Joi.object({
  username: Joi.string().min(2).max(50).optional(),
  currentPassword: Joi.string().min(6).max(128).optional(),
  newPassword: Joi.string().min(6).max(128).optional()
});
const deleteAccountSchema = Joi.object({
  password: Joi.string().min(6).max(128).required(),
  confirmText: Joi.string().valid('SUPPRIMER MON COMPTE').required()
});

// Inscription
const register = async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const { email, password, username } = value;

    // Vérifier si l'utilisateur existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Utilisateur déjà existant' });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer l'utilisateur
    const user = new User({
      email,
      password: hashedPassword,
      username: username || email.split('@')[0],
      role: 'visitor'
    });

    await user.save();

    // Générer le token
    const token = jwt.sign(
      { userId: user._id, email: user.email, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      token,
      user: { id: user._id, email: user.email, username: user.username, role: user.role }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Connexion
const login = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const { email, password } = value;

    // Trouver l'utilisateur
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Identifiants incorrects' });
    }

    // Vérifier le mot de passe
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Identifiants incorrects' });
    }

    // Générer le token
    const token = jwt.sign(
      { userId: user._id, email: user.email, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Connexion réussie',
      token,
      user: { id: user._id, email: user.email, username: user.username, role: user.role }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Profil utilisateur
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Mettre à jour le profil
const updateProfile = async (req, res) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const { username, currentPassword, newPassword } = value;
    const userId = req.user.userId;

    // Trouver l'utilisateur
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Vérifier le mot de passe actuel si un nouveau mot de passe est fourni
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Le mot de passe actuel est requis' });
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: 'Mot de passe actuel incorrect' });
      }

      // Hasher le nouveau mot de passe
      const saltRounds = 12;
      user.password = await bcrypt.hash(newPassword, saltRounds);
    }

    // Mettre à jour le pseudonyme
    if (username) {
      user.username = username;
    }

    await user.save();

    res.json({
      message: 'Profil mis à jour avec succès',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Supprimer son propre compte
const deleteAccount = async (req, res) => {
  try {
    const { error, value } = deleteAccountSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const { password, confirmText } = value;
    const userId = req.user.userId;

    // Vérifications de sécurité
    if (!password) {
      return res.status(400).json({ message: 'Mot de passe requis pour supprimer le compte' });
    }

    if (confirmText !== 'SUPPRIMER MON COMPTE') {
      return res.status(400).json({ message: 'Confirmation de suppression incorrecte' });
    }

    // Récupérer l'utilisateur
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Mot de passe incorrect' });
    }

    // Import dynamique pour éviter les dépendances circulaires
    const { default: Like } = await import('../models/Like.js');
    const { default: Article } = await import('../models/Article.js');
    const { default: Review } = await import('../models/Review.js');
    const { default: Comment } = await import('../models/Comment.js');

    console.log(`🗑️ Auto-suppression de compte : ${user.email} (${user.username}) - Rôle: ${user.role}`);
    if (user.role === 'admin') {
      console.log(`  ⚠️ SUPPRESSION D'UN ADMINISTRATEUR - Perte des privilèges d'administration`);
    }

    // 1. Supprimer tous les likes de cet utilisateur
    const deletedLikes = await Like.deleteMany({ user: userId });
    console.log(`  ❌ ${deletedLikes.deletedCount} likes de l'utilisateur supprimés`);

    // 2. Gérer les articles créés par cet utilisateur
    const userArticles = await Article.find({ author: userId });
    if (userArticles.length > 0) {
      await Like.deleteMany({ 
        contentType: 'article', 
        contentId: { $in: userArticles.map(a => a._id) } 
      });
      await Article.deleteMany({ author: userId });
      console.log(`  📰 ${userArticles.length} articles supprimés avec leurs likes`);
    }

    // 3. Gérer les reviews créées par cet utilisateur  
    const userReviews = await Review.find({ author: userId });
    if (userReviews.length > 0) {
      await Like.deleteMany({ 
        contentType: 'review', 
        contentId: { $in: userReviews.map(r => r._id) } 
      });
      await Review.deleteMany({ author: userId });
      console.log(`  ⭐ ${userReviews.length} reviews supprimées avec leurs likes`);
    }

    // 4. Traiter les commentaires créés par cet utilisateur
    const userComments = await Comment.find({ author: userId });
    let deletedCommentsCount = 0;
    let softDeletedCommentsCount = 0;

    if (userComments.length > 0) {
      for (const comment of userComments) {
        await Like.deleteMany({ 
          contentType: 'comment', 
          contentId: comment._id 
        });

        const canHardDelete = await comment.canBeHardDeleted();
        
        if (canHardDelete) {
          await Comment.findByIdAndDelete(comment._id);
          deletedCommentsCount++;
        } else {
          await comment.softDelete();
          softDeletedCommentsCount++;
        }
      }
      console.log(`  💬 ${deletedCommentsCount} commentaires supprimés définitivement`);
      console.log(`  🔄 ${softDeletedCommentsCount} commentaires anonymisés (réponses conservées)`);
    }

    // 5. Supprimer l'utilisateur
    await User.findByIdAndDelete(userId);
    console.log(`  👤 Compte ${user.email} supprimé définitivement par l'utilisateur lui-même`);

    const message = user.role === 'admin' 
      ? 'Votre compte administrateur a été supprimé définitivement. Vous avez perdu tous vos privilèges d\'administration. Au revoir !'
      : 'Votre compte a été supprimé définitivement. Au revoir !';

    res.json({
      message,
      deletedData: {
        likes: deletedLikes.deletedCount,
        articles: userArticles.length,
        reviews: userReviews.length,
        comments: deletedCommentsCount,
        anonymizedComments: softDeletedCommentsCount,
        wasAdmin: user.role === 'admin'
      }
    });

  } catch (error) {
    console.error('Erreur auto-suppression compte:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

export {
  register,
  login,
  getProfile,
  updateProfile,
  deleteAccount
}; 