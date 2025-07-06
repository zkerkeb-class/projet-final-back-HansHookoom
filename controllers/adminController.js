import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Article from '../models/Article.js';
import Review from '../models/Review.js';
import Comment from '../models/Comment.js';
import Like from '../models/Like.js';

// Promouvoir un utilisateur en admin (Admin seulement)
const promoteUser = async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId && !email) {
      return res.status(400).json({ message: 'ID utilisateur ou email requis' });
    }

    // Trouver l'utilisateur par ID ou email
    const query = userId ? { _id: userId } : { email: email };
    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cet utilisateur est déjà administrateur' });
    }

    // Promouvoir en admin
    user.role = 'admin';
    await user.save();

    console.log(`🔧 Admin promu : ${user.email} par ${req.user.username} (${req.user.email})`);

    res.json({
      message: `Utilisateur ${user.username} (${user.email}) promu administrateur avec succès`,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Erreur promotion admin:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Créer le premier admin (seulement si aucun admin n'existe)
const createFirstAdmin = async (req, res) => {
  try {
    const { email, password, username, secretKey } = req.body;

    // Vérifier la clé secrète
    const FIRST_ADMIN_SECRET = process.env.FIRST_ADMIN_SECRET;
    if (!FIRST_ADMIN_SECRET) {
      return res.status(503).json({ message: 'Configuration serveur incomplète' });
    }
    if (secretKey !== FIRST_ADMIN_SECRET) {
      return res.status(403).json({ message: 'Clé secrète invalide' });
    }

    // Vérifier qu'aucun admin n'existe déjà
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Un administrateur existe déjà' });
    }

    // Vérifier que l'utilisateur n'existe pas déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer le premier admin
    const admin = new User({
      email,
      password: hashedPassword,
      username: username || email.split('@')[0],
      role: 'admin'
    });

    await admin.save();

    console.log(`🚀 Premier administrateur créé : ${admin.email}`);

    res.status(201).json({
      message: 'Premier administrateur créé avec succès',
      admin: {
        id: admin._id,
        email: admin.email,
        username: admin.username,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Erreur création premier admin:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Lister tous les utilisateurs (Admin seulement)
const getUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select('-password') // Exclure le mot de passe
      .sort({ createdAt: -1 });

    res.json({
      users: users,
      stats: {
        total: users.length,
        admins: users.filter(u => u.role === 'admin').length,
        visitors: users.filter(u => u.role === 'visitor').length
      }
    });

  } catch (error) {
    console.error('Erreur récupération utilisateurs:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Supprimer un utilisateur avec cascade (Admin seulement)
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { confirmAction } = req.body;

    if (!confirmAction) {
      return res.status(400).json({ message: 'Confirmation de suppression requise' });
    }

    // Vérifier que l'utilisateur existe
    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Empêcher l'auto-suppression
    if (userId === req.user.userId) {
      return res.status(400).json({ message: 'Vous ne pouvez pas vous supprimer vous-même' });
    }

    console.log(`🗑️ Début suppression utilisateur : ${userToDelete.email} par ${req.user.email}`);

    // 1. Supprimer tous les likes de cet utilisateur
    const deletedLikes = await Like.deleteMany({ user: userId });
    console.log(`  ❌ ${deletedLikes.deletedCount} likes supprimés`);

    // 2. Décrémenter les compteurs de likes des contenus
    if (deletedLikes.deletedCount > 0) {
      // Récupérer tous les articles/reviews qui avaient des likes de cet utilisateur
      const userLikes = await Like.find({ user: userId }).lean();
      
      for (const like of userLikes) {
        if (like.contentType === 'article') {
          await Article.findByIdAndUpdate(like.contentId, { $inc: { likeCount: -1 } });
        } else if (like.contentType === 'review') {
          await Review.findByIdAndUpdate(like.contentId, { $inc: { likeCount: -1 } });
        }
      }
      console.log(`  📊 Compteurs de likes mis à jour`);
    }

    // 3. Traiter les articles créés par cet utilisateur
    const userArticles = await Article.find({ author: userId });
    if (userArticles.length > 0) {
      // Option 1: Supprimer les articles et leurs likes
      await Like.deleteMany({ 
        contentType: 'article', 
        contentId: { $in: userArticles.map(a => a._id) } 
      });
      await Article.deleteMany({ author: userId });
      console.log(`  📰 ${userArticles.length} articles supprimés avec leurs likes`);
    }

    // 4. Traiter les reviews créées par cet utilisateur  
    const userReviews = await Review.find({ author: userId });
    if (userReviews.length > 0) {
      // Supprimer les likes sur ces reviews
      await Like.deleteMany({ 
        contentType: 'review', 
        contentId: { $in: userReviews.map(r => r._id) } 
      });
      // Supprimer les reviews
      await Review.deleteMany({ author: userId });
      console.log(`  ⭐ ${userReviews.length} reviews supprimées avec leurs likes`);
    }

    // 5. Traiter les commentaires créés par cet utilisateur
    const userComments = await Comment.find({ author: userId });
    let deletedCommentsCount = 0;
    let softDeletedCommentsCount = 0;

    if (userComments.length > 0) {
      for (const comment of userComments) {
        // Supprimer tous les likes de ce commentaire
        await Like.deleteMany({ 
          contentType: 'comment', 
          contentId: comment._id 
        });

        // Vérifier s'il peut être supprimé définitivement
        const canHardDelete = await comment.canBeHardDeleted();
        
        if (canHardDelete) {
          // Suppression définitive
          await Comment.findByIdAndDelete(comment._id);
          deletedCommentsCount++;
        } else {
          // Soft delete - il y a des réponses
          await comment.softDelete();
          softDeletedCommentsCount++;
        }
      }
      console.log(`  💬 ${deletedCommentsCount} commentaires supprimés définitivement`);
      console.log(`  🔄 ${softDeletedCommentsCount} commentaires anonymisés (réponses conservées)`);
    }

    // 6. Supprimer l'utilisateur
    await User.findByIdAndDelete(userId);
    console.log(`  👤 Utilisateur ${userToDelete.email} supprimé définitivement`);

    res.json({
      message: `Utilisateur ${userToDelete.username} (${userToDelete.email}) supprimé avec succès`,
      deletedData: {
        likes: deletedLikes.deletedCount,
        articles: userArticles.length,
        reviews: userReviews.length,
        comments: deletedCommentsCount,
        anonymizedComments: softDeletedCommentsCount
      }
    });

  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Nettoyer les likes orphelins (Admin seulement)
const cleanupOrphanedLikes = async (req, res) => {
  try {
    console.log(`🧹 Début nettoyage des likes orphelins par ${req.user.email}`);

    // Trouver tous les likes dont l'utilisateur n'existe plus
    const allLikes = await Like.find({}).populate('user');
    const orphanedLikes = allLikes.filter(like => !like.user);

    if (orphanedLikes.length === 0) {
      return res.json({ message: 'Aucun like orphelin trouvé', cleaned: 0 });
    }

    console.log(`  🔍 ${orphanedLikes.length} likes orphelins trouvés`);

    // Décrémenter les compteurs pour chaque like orphelin
    for (const like of orphanedLikes) {
      if (like.contentType === 'article') {
        await Article.findByIdAndUpdate(like.contentId, { $inc: { likeCount: -1 } });
      } else if (like.contentType === 'review') {
        await Review.findByIdAndUpdate(like.contentId, { $inc: { likeCount: -1 } });
      }
    }

    // Supprimer les likes orphelins
    const orphanedIds = orphanedLikes.map(like => like._id);
    const deleteResult = await Like.deleteMany({ _id: { $in: orphanedIds } });

    console.log(`  ✅ ${deleteResult.deletedCount} likes orphelins supprimés`);
    console.log(`  📊 Compteurs de likes corrigés`);

    res.json({
      message: `Nettoyage terminé : ${deleteResult.deletedCount} likes orphelins supprimés`,
      cleaned: deleteResult.deletedCount,
      details: orphanedLikes.map(like => ({
        contentType: like.contentType,
        contentId: like.contentId,
        likedAt: like.likedAt
      }))
    });

  } catch (error) {
    console.error('Erreur nettoyage likes orphelins:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Diagnostic de cohérence des likes (Admin seulement)
const getDiagnostic = async (req, res) => {
  try {
    console.log(`🔍 Diagnostic des likes par ${req.user.email}`);

    // 1. Compter les vrais likes par type
    const realTotalLikes = await Like.countDocuments();
    const realArticleLikes = await Like.countDocuments({ contentType: 'article' });
    const realReviewLikes = await Like.countDocuments({ contentType: 'review' });
    const realCommentLikes = await Like.countDocuments({ contentType: 'comment' });

    // 2. Compter les likes selon les compteurs des articles/reviews
    const articles = await Article.find({}, 'title likeCount');
    const reviews = await Review.find({}, 'title gameTitle likeCount');
    const comments = await Comment.find({}, 'content likesCount');

    const articleCountersSum = articles.reduce((sum, article) => sum + (article.likeCount || 0), 0);
    const reviewCountersSum = reviews.reduce((sum, review) => sum + (review.likeCount || 0), 0);
    const commentCountersSum = comments.reduce((sum, comment) => sum + (comment.likesCount || 0), 0);

    // 3. Identifier les incohérences par article/review
    const articleInconsistencies = [];
    for (const article of articles) {
      const realLikes = await Like.countDocuments({ 
        contentType: 'article', 
        contentId: article._id 
      });
      if (realLikes !== (article.likeCount || 0)) {
        articleInconsistencies.push({
          id: article._id,
          title: article.title,
          realLikes,
          storedCount: article.likeCount || 0,
          difference: realLikes - (article.likeCount || 0)
        });
      }
    }

    const reviewInconsistencies = [];
    for (const review of reviews) {
      const realLikes = await Like.countDocuments({ 
        contentType: 'review', 
        contentId: review._id 
      });
      if (realLikes !== (review.likeCount || 0)) {
        reviewInconsistencies.push({
          id: review._id,
          title: review.gameTitle || review.title,
          realLikes,
          storedCount: review.likeCount || 0,
          difference: realLikes - (review.likeCount || 0)
        });
      }
    }

    const commentInconsistencies = [];
    for (const comment of comments) {
      const realLikes = await Like.countDocuments({ 
        contentType: 'comment', 
        contentId: comment._id 
      });
      if (realLikes !== (comment.likesCount || 0)) {
        commentInconsistencies.push({
          id: comment._id,
          content: comment.content?.substring(0, 50) + '...',
          realLikes,
          storedCount: comment.likesCount || 0,
          difference: realLikes - (comment.likesCount || 0)
        });
      }
    }

    // 4. Vérifier les likes orphelins
    const allLikes = await Like.find({}).populate('user');
    const orphanedLikes = allLikes.filter(like => !like.user);

    const diagnostic = {
      realCounts: {
        total: realTotalLikes,
        articles: realArticleLikes,
        reviews: realReviewLikes,
        comments: realCommentLikes
      },
      storedCounts: {
        articles: articleCountersSum,
        reviews: reviewCountersSum,
        comments: commentCountersSum,
        total: articleCountersSum + reviewCountersSum + commentCountersSum
      },
      inconsistencies: {
        articles: articleInconsistencies,
        reviews: reviewInconsistencies,
        comments: commentInconsistencies,
        totalInconsistent: articleInconsistencies.length + reviewInconsistencies.length + commentInconsistencies.length
      },
      orphanedLikes: orphanedLikes.length,
      summary: {
        isConsistent: articleInconsistencies.length === 0 && reviewInconsistencies.length === 0 && commentInconsistencies.length === 0,
        needsSync: articleInconsistencies.length > 0 || reviewInconsistencies.length > 0 || commentInconsistencies.length > 0,
        hasOrphans: orphanedLikes.length > 0
      }
    };

    console.log(`  📊 Diagnostic terminé:`, diagnostic.summary);

    res.json(diagnostic);

  } catch (error) {
    console.error('Erreur diagnostic likes:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

// Resynchroniser les compteurs de likes (Admin seulement)
const syncCounters = async (req, res) => {
  try {
    console.log(`🔄 Synchronisation des compteurs de likes par ${req.user.email}`);

    let articlesFixed = 0;
    let reviewsFixed = 0;
    let commentsFixed = 0;

    // 1. Resynchroniser les articles
    const articles = await Article.find({});
    for (const article of articles) {
      const realLikes = await Like.countDocuments({ 
        contentType: 'article', 
        contentId: article._id 
      });
      
      if (realLikes !== (article.likeCount || 0)) {
        await Article.findByIdAndUpdate(article._id, { 
          likeCount: realLikes 
        });
        console.log(`  📰 Article "${article.title}": ${article.likeCount || 0} → ${realLikes}`);
        articlesFixed++;
      }
    }

    // 2. Resynchroniser les reviews
    const reviews = await Review.find({});
    for (const review of reviews) {
      const realLikes = await Like.countDocuments({ 
        contentType: 'review', 
        contentId: review._id 
      });
      
      if (realLikes !== (review.likeCount || 0)) {
        await Review.findByIdAndUpdate(review._id, { 
          likeCount: realLikes 
        });
        console.log(`  ⭐ Review "${review.gameTitle || review.title}": ${review.likeCount || 0} → ${realLikes}`);
        reviewsFixed++;
      }
    }

    // 3. Resynchroniser les commentaires
    const comments = await Comment.find({});
    for (const comment of comments) {
      const realLikes = await Like.countDocuments({ 
        contentType: 'comment', 
        contentId: comment._id 
      });
      
      if (realLikes !== (comment.likesCount || 0)) {
        await Comment.findByIdAndUpdate(comment._id, { 
          likesCount: realLikes 
        });
        console.log(`  💬 Commentaire: ${comment.likesCount || 0} → ${realLikes}`);
        commentsFixed++;
      }
    }

    const totalFixed = articlesFixed + reviewsFixed + commentsFixed;
    console.log(`  ✅ Synchronisation terminée: ${totalFixed} éléments corrigés`);

    res.json({
      message: `Synchronisation terminée avec succès`,
      fixed: {
        articles: articlesFixed,
        reviews: reviewsFixed,
        comments: commentsFixed,
        total: totalFixed
      },
      summary: totalFixed === 0 ? 'Tous les compteurs étaient déjà synchronisés' : `${totalFixed} compteurs ont été corrigés`
    });

  } catch (error) {
    console.error('Erreur synchronisation compteurs:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
};

export {

  getUsers,
  promoteUser,
  createFirstAdmin,
  deleteUser,
  cleanupOrphanedLikes,
  getDiagnostic,
  syncCounters

}; 