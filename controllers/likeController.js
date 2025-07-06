import Like from '../models/Like.js';
import Article from '../models/Article.js';
import Review from '../models/Review.js';
import Comment from '../models/Comment.js';

// Liker/Unliker un contenu (Articles ou Reviews ou Comments)
const toggleLike = async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const userId = req.user.userId;

    // Valider le type de contenu
    if (!['article', 'review', 'comment'].includes(contentType)) {
      return res.status(400).json({ message: 'Type de contenu invalide' });
    }

    // Vérifier si le contenu existe
    const Model = contentType === 'article' ? Article : contentType === 'review' ? Review : Comment;
    const content = await Model.findById(contentId);
    if (!content) {
      return res.status(404).json({ message: `${contentType} non trouvé` });
    }

    // Vérifier si l'utilisateur a déjà liké ce contenu
    const existingLike = await Like.findOne({ 
      user: userId, 
      contentId, 
      contentType 
    });

    if (existingLike) {
      // Unlike - Supprimer le like
      await Like.findByIdAndDelete(existingLike._id);
      
      // Décrémenter le compteur
      const updateField = contentType === 'comment' ? 'likesCount' : 'likeCount';
      await Model.findByIdAndUpdate(contentId, {
        $inc: { [updateField]: -1 }
      });

      // Récupérer le contenu mis à jour
      const updatedContent = await Model.findById(contentId);
      const likeCount = contentType === 'comment' ? updatedContent.likesCount : updatedContent.likeCount;

      return res.json({
        message: 'Like supprimé',
        liked: false,
        likeCount: likeCount || 0
      });
    } else {
      // Like - Créer un nouveau like
      const newLike = new Like({
        user: userId,
        contentId,
        contentType
      });
      await newLike.save();

      // Incrémenter le compteur
      const updateField = contentType === 'comment' ? 'likesCount' : 'likeCount';
      await Model.findByIdAndUpdate(contentId, {
        $inc: { [updateField]: 1 }
      });

      // Récupérer le contenu mis à jour
      const updatedContent = await Model.findById(contentId);
      const likeCount = contentType === 'comment' ? updatedContent.likesCount : updatedContent.likeCount;

      return res.json({
        message: 'Like ajouté',
        liked: true,
        likeCount: likeCount || 0
      });
    }

  } catch (error) {
    console.error('Erreur like/unlike:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Vous avez déjà liké ce contenu' });
    }
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Obtenir l'état de like d'un contenu pour un utilisateur
const getLikeStatus = async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const userId = req.user.userId;

    // Valider le type de contenu
    if (!['article', 'review', 'comment'].includes(contentType)) {
      return res.status(400).json({ message: 'Type de contenu invalide' });
    }

    // Vérifier si l'utilisateur a liké ce contenu
    const liked = await Like.isLikedByUser(contentId, contentType, userId);
    
    // Obtenir le nombre total de likes
    const likeCount = await Like.getLikeCount(contentId, contentType);

    res.json({
      liked,
      likeCount
    });

  } catch (error) {
    console.error('Erreur récupération état like:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Obtenir la liste des likes pour un contenu (Admin)
const getContentLikes = async (req, res) => {
  try {
    const { contentType, contentId } = req.params;

    // Valider le type de contenu
    if (!['article', 'review', 'comment'].includes(contentType)) {
      return res.status(400).json({ message: 'Type de contenu invalide' });
    }

    const likes = await Like.getLikesForContent(contentId, contentType);

    res.json({
      contentType,
      contentId,
      likeCount: likes.length,
      likes: likes.map(like => ({
        id: like._id,
        user: {
          id: like.user._id,
          username: like.user.username,
          email: like.user.email
        },
        likedAt: like.createdAt
      }))
    });

  } catch (error) {
    console.error('Erreur récupération likes admin:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Obtenir les statistiques générales des likes (Admin)
const getLikesStats = async (req, res) => {
  try {
    // Calculer les statistiques à partir des compteurs des documents (plus précis)
    const articles = await Article.find({}, 'likeCount');
    const reviews = await Review.find({}, 'likeCount');
    const comments = await Comment.find({}, 'likesCount');

    const totalArticleLikes = articles.reduce((sum, article) => sum + (article.likeCount || 0), 0);
    const totalReviewLikes = reviews.reduce((sum, review) => sum + (review.likeCount || 0), 0);
    const totalCommentLikes = comments.reduce((sum, comment) => sum + (comment.likesCount || 0), 0);
    const totalLikes = totalArticleLikes + totalReviewLikes + totalCommentLikes;

    // Top 5 contenus les plus likés
    const topArticles = await Article.find({})
      .sort({ likeCount: -1 })
      .limit(5)
      .select('title slug likeCount')
      .populate('author', 'username');

    const topReviews = await Review.find({})
      .sort({ likeCount: -1 })
      .limit(5)
      .select('title gameTitle slug likeCount')
      .populate('author', 'username');

    // Top commentaires les plus likés
    const topComments = await Comment.find({ isDeleted: false })
      .sort({ likesCount: -1 })
      .limit(5)
      .select('content likesCount article')
      .populate('author', 'username')
      .populate('article', 'title');

    // Utilisateurs les plus actifs (qui likent le plus)
    const topLikers = await Like.aggregate([
      {
        $group: {
          _id: '$user',
          likesCount: { $sum: 1 }
        }
      },
      {
        $sort: { likesCount: -1 }
      },
      {
        $limit: 5
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          username: '$user.username',
          email: '$user.email',
          likesCount: 1
        }
      }
    ]);

    res.json({
      stats: {
        totalLikes,
        totalArticleLikes,
        totalReviewLikes,
        totalCommentLikes
      },
      topContent: {
        articles: topArticles,
        reviews: topReviews,
        comments: topComments
      },
      topLikers
    });

  } catch (error) {
    console.error('Erreur statistiques likes:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export {
  toggleLike,
  getLikeStatus,
  getContentLikes,
  getLikesStats
}; 