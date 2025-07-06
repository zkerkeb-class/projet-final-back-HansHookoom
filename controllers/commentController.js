import Comment from '../models/Comment.js';
import Article from '../models/Article.js';
import Review from '../models/Review.js';
import Like from '../models/Like.js';
import mongoose from 'mongoose';
import Joi from 'joi';

// Schéma Joi pour la validation d'un commentaire
const commentSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required(),
  articleId: Joi.string().optional(),
  reviewId: Joi.string().optional(),
  parentCommentId: Joi.string().optional()
});

// Récupérer les commentaires d'un article
const getArticleComments = async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.user?.userId; // Optionnel pour les visiteurs non connectés
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'recent'; // 'recent' ou 'likes'
    
    console.log(`📝 Récupération commentaires pour article ${articleId}, page ${page}, user: ${userId || 'anonyme'}`);
    
    // Vérifier si l'article existe
    const article = await Article.findById(articleId);
    if (!article) {
      console.log(`❌ Article ${articleId} non trouvé`);
      return res.status(404).json({ message: 'Article non trouvé' });
    }

    console.log(`✅ Article trouvé: ${article.title}`);

    // Compter le total de TOUS les commentaires (principaux + réponses)
    const totalComments = await Comment.countDocuments({ 
      article: articleId
    });

    // Définir le tri selon le paramètre
    let sortOptions = {};
    if (sortBy === 'likes') {
      // Pour le tri par likes, utiliser une agrégation
      const pipeline = [
        // Filtrer par article
        { $match: { article: new mongoose.Types.ObjectId(articleId) } },
        
        // Joindre avec les likes pour compter
        {
          $lookup: {
            from: 'likes',
            let: { commentId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$contentId', '$$commentId'] },
                      { $eq: ['$contentType', 'comment'] }
                    ]
                  }
                }
              }
            ],
            as: 'likes'
          }
        },
        
        // Ajouter le nombre de likes
        { $addFields: { likesCount: { $size: '$likes' } } },
        
        // Trier par nombre de likes (décroissant) puis par date (décroissant)
        { $sort: { likesCount: -1, createdAt: -1 } },
        
        // Pagination
        { $skip: skip },
        { $limit: limit },
        
        // Populate author
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
            pipeline: [{ $project: { username: 1, email: 1, role: 1 } }]
          }
        },
        { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
        
        // Populate parentComment
        {
          $lookup: {
            from: 'comments',
            localField: 'parentComment',
            foreignField: '_id',
            as: 'parentComment',
            pipeline: [
              { $project: { content: 1, author: 1, isDeleted: 1 } },
              {
                $lookup: {
                  from: 'users',
                  localField: 'author',
                  foreignField: '_id',
                  as: 'author',
                  pipeline: [{ $project: { username: 1 } }]
                }
              },
              { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } }
            ]
          }
        },
        { $unwind: { path: '$parentComment', preserveNullAndEmptyArrays: true } }
      ];
      
      const allComments = await Comment.aggregate(pipeline);
      
      // Utiliser directement les résultats d'agrégation
      var finalComments = allComments;
    } else {
      // Tri par date (défaut)
      var finalComments = await Comment.find({ 
        article: articleId
      })
        .populate('author', 'username email role')
        .populate({
          path: 'parentComment',
          select: 'content author isDeleted',
          populate: {
            path: 'author',
            select: 'username'
          }
        })
        .sort({ createdAt: -1 }) // Tri par date décroissante (plus récents en premier)
        .skip(skip)
        .limit(limit);
    }

    console.log(`📊 ${finalComments.length} commentaires trouvés sur ${totalComments} total`);

    // Ajouter les informations de likes pour chaque commentaire
    const commentsWithLikes = await Promise.all(
      finalComments.map(async (comment) => {
        try {
          const liked = userId ? await Like.isLikedByUser(comment._id, 'comment', userId) : false;
          
          // Gérer différemment les documents d'agrégation et les documents Mongoose normaux
          const commentObject = comment.toObject ? comment.toObject() : comment;
          
          return {
            ...commentObject,
            isLiked: liked,
            canDelete: userId && comment.author && comment.author._id.toString() === userId
          };
        } catch (commentError) {
          console.error(`❌ Erreur traitement commentaire ${comment._id}:`, commentError);
          
          // Gérer différemment les documents d'agrégation et les documents Mongoose normaux
          const commentObject = comment.toObject ? comment.toObject() : comment;
          
          return {
            ...commentObject,
            isLiked: false,
            canDelete: userId && comment.author && comment.author._id.toString() === userId
          };
        }
      })
    );

    console.log(`✅ Commentaires traités avec succès`);

    res.json({
      comments: commentsWithLikes,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalComments / limit),
        hasNextPage: page < Math.ceil(totalComments / limit),
        totalComments: totalComments
      }
    });

  } catch (error) {
    console.error('❌ ERREUR RÉCUPÉRATION COMMENTAIRES:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ message: 'Erreur serveur', details: error.message });
  }
};

// Récupérer les commentaires d'une review
const getReviewComments = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user?.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'recent'; // 'recent' ou 'likes'
    
    console.log(`📝 Récupération commentaires pour review ${reviewId}, page ${page}, user: ${userId || 'anonyme'}`);
    
    // Vérifier si la review existe
    const review = await Review.findById(reviewId);
    if (!review) {
      console.log(`❌ Review ${reviewId} non trouvée`);
      return res.status(404).json({ message: 'Review non trouvée' });
    }

    console.log(`✅ Review trouvée: ${review.gameTitle || review.title}`);

    // Compter le total de TOUS les commentaires (principaux + réponses)
    const totalComments = await Comment.countDocuments({ 
      review: reviewId
    });

    // Définir le tri selon le paramètre
    let finalComments;
    if (sortBy === 'likes') {
      // Pour le tri par likes, utiliser une agrégation
      const pipeline = [
        // Filtrer par review
        { $match: { review: new mongoose.Types.ObjectId(reviewId) } },
        
        // Joindre avec les likes pour compter
        {
          $lookup: {
            from: 'likes',
            let: { commentId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$contentId', '$$commentId'] },
                      { $eq: ['$contentType', 'comment'] }
                    ]
                  }
                }
              }
            ],
            as: 'likes'
          }
        },
        
        // Ajouter le nombre de likes
        { $addFields: { likesCount: { $size: '$likes' } } },
        
        // Trier par nombre de likes (décroissant) puis par date (décroissant)
        { $sort: { likesCount: -1, createdAt: -1 } },
        
        // Pagination
        { $skip: skip },
        { $limit: limit },
        
        // Populate author
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
            pipeline: [{ $project: { username: 1, email: 1, role: 1 } }]
          }
        },
        { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
        
        // Populate parentComment
        {
          $lookup: {
            from: 'comments',
            localField: 'parentComment',
            foreignField: '_id',
            as: 'parentComment',
            pipeline: [
              { $project: { content: 1, author: 1, isDeleted: 1 } },
              {
                $lookup: {
                  from: 'users',
                  localField: 'author',
                  foreignField: '_id',
                  as: 'author',
                  pipeline: [{ $project: { username: 1 } }]
                }
              },
              { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } }
            ]
          }
        },
        { $unwind: { path: '$parentComment', preserveNullAndEmptyArrays: true } }
      ];
      
      const aggregatedComments = await Comment.aggregate(pipeline);
      
      // Utiliser directement les résultats d'agrégation
      finalComments = aggregatedComments;
    } else {
      // Tri par date (défaut)
      finalComments = await Comment.find({ 
        review: reviewId
      })
        .populate('author', 'username email role')
        .populate({
          path: 'parentComment',
          select: 'content author isDeleted',
          populate: {
            path: 'author',
            select: 'username'
          }
        })
        .sort({ createdAt: -1 }) // Tri par date décroissante (plus récents en premier)
        .skip(skip)
        .limit(limit);
    }

    console.log(`📊 ${finalComments.length} commentaires trouvés sur ${totalComments} total pour la review`);

    // Ajouter les informations de likes pour chaque commentaire
    const commentsWithLikes = await Promise.all(
      finalComments.map(async (comment) => {
        try {
          const liked = userId ? await Like.isLikedByUser(comment._id, 'comment', userId) : false;
          
          // Gérer différemment les documents d'agrégation et les documents Mongoose normaux
          const commentObject = comment.toObject ? comment.toObject() : comment;
          
          return {
            ...commentObject,
            isLiked: liked,
            canDelete: userId && comment.author && comment.author._id.toString() === userId
          };
        } catch (commentError) {
          console.error(`❌ Erreur traitement commentaire review ${comment._id}:`, commentError);
          
          // Gérer différemment les documents d'agrégation et les documents Mongoose normaux
          const commentObject = comment.toObject ? comment.toObject() : comment;
          
          return {
            ...commentObject,
            isLiked: false,
            canDelete: userId && comment.author && comment.author._id.toString() === userId
          };
        }
      })
    );

    console.log(`✅ Commentaires review traités avec succès`);

    res.json({
      comments: commentsWithLikes,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalComments / limit),
        hasNextPage: page < Math.ceil(totalComments / limit),
        totalComments: totalComments
      }
    });

  } catch (error) {
    console.error('❌ ERREUR RÉCUPÉRATION COMMENTAIRES REVIEW:', error);
    res.status(500).json({ message: 'Erreur serveur', details: error.message });
  }
};

// Ajouter un commentaire
const createComment = async (req, res) => {
  try {
    const { error, value } = commentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    const { content, articleId, reviewId, parentCommentId } = value;
    const userId = req.user.userId;

    // Validation
    
    // Il faut soit un articleId soit un reviewId
    if (!articleId && !reviewId) {
      return res.status(400).json({ message: 'ArticleId ou ReviewId requis' });
    }

    if (articleId && reviewId) {
      return res.status(400).json({ message: 'Ne peut pas commenter un article ET une review simultanément' });
    }

    // Vérifier si l'article ou la review existe
    let contentExists = false;
    if (articleId) {
      const article = await Article.findById(articleId);
      contentExists = !!article;
      if (!contentExists) {
        return res.status(404).json({ message: 'Article non trouvé' });
      }
    } else if (reviewId) {
      const review = await Review.findById(reviewId);
      contentExists = !!review;
      if (!contentExists) {
        return res.status(404).json({ message: 'Review non trouvée' });
      }
    }

    // Si c'est une réponse, vérifier que le commentaire parent existe
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({ message: 'Commentaire parent non trouvé' });
      }

      // Vérifier que le parent est sur le même contenu
      if (articleId && !parentComment.article) {
        return res.status(400).json({ message: 'Le commentaire parent n\'est pas sur cet article' });
      }
      if (reviewId && !parentComment.review) {
        return res.status(400).json({ message: 'Le commentaire parent n\'est pas sur cette review' });
      }
    }

    // Créer le commentaire
    const commentData = {
      content: content.trim(),
      author: userId,
      parentComment: parentCommentId || null
    };

    if (articleId) {
      commentData.article = articleId;
    } else if (reviewId) {
      commentData.review = reviewId;
    }

    const comment = new Comment(commentData);
    await comment.save();

    // Peupler les informations de l'auteur
    const populatedComment = await Comment.findById(comment._id)
      .populate('author', 'username email role')
      .populate({
        path: 'parentComment',
        select: 'content author isDeleted',
        populate: {
          path: 'author',
          select: 'username'
        }
      });

    res.status(201).json({
      message: 'Commentaire ajouté avec succès',
      comment: {
        ...populatedComment.toObject(),
        isLiked: false,
        canDelete: true,
        replies: []
      }
    });

  } catch (error) {
    console.error('Erreur ajout commentaire:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Supprimer un commentaire
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;
    const isAdmin = req.user.role === 'admin';

    console.log(`🗑️ Tentative suppression commentaire ${commentId} par ${req.user.email}`);

    // Vérifier que l'ID est valide
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      console.log(`❌ ID invalide: ${commentId}`);
      return res.status(400).json({ message: 'ID de commentaire invalide' });
    }

    // Récupérer le commentaire
    const comment = await Comment.findById(commentId);
    if (!comment) {
      console.log(`❌ Commentaire ${commentId} non trouvé`);
      return res.status(404).json({ message: 'Commentaire non trouvé' });
    }

    console.log(`📝 Commentaire trouvé - Author: ${comment.author}, User: ${userId}, Admin: ${isAdmin}`);

    // Vérifier les permissions (propriétaire ou admin)
    if (comment.author.toString() !== userId && !isAdmin) {
      console.log(`🚫 Permission refusée pour suppression commentaire ${commentId}`);
      return res.status(403).json({ message: 'Non autorisé à supprimer ce commentaire' });
    }

    console.log(`✅ Permissions validées, vérification des réponses...`);

    // Vérifier s'il y a des réponses avec gestion d'erreur
    let canHardDelete;
    try {
      canHardDelete = await comment.canBeHardDeleted();
      console.log(`🔍 CanHardDelete: ${canHardDelete}`);
    } catch (deleteCheckError) {
      console.error('❌ Erreur lors de la vérification canBeHardDeleted:', deleteCheckError);
      return res.status(500).json({ message: 'Erreur lors de la vérification des réponses' });
    }

    if (canHardDelete) {
      // Suppression définitive - pas de réponses
      console.log(`🗑️ Suppression définitive du commentaire ${commentId}`);
      
      // Supprimer tous les likes du commentaire
      const deletedLikesHard = await Like.deleteMany({ 
        contentId: commentId, 
        contentType: 'comment' 
      });
      console.log(`  ❌ ${deletedLikesHard.deletedCount} likes supprimés`);

      // Supprimer le commentaire
      await Comment.findByIdAndDelete(commentId);
      console.log(`  ✅ Commentaire ${commentId} supprimé définitivement`);
      
      res.json({ 
        message: 'Commentaire supprimé définitivement',
        deleted: true,
        hardDeleted: true
      });
    } else {
      // Soft delete - il y a des réponses
      console.log(`🔄 Soft delete du commentaire ${commentId} (réponses présentes)`);
      
      // Supprimer tous les likes du commentaire
      const deletedLikesSoft = await Like.deleteMany({ 
        contentId: commentId, 
        contentType: 'comment' 
      });
      console.log(`  ❌ ${deletedLikesSoft.deletedCount} likes supprimés`);

      // Réinitialiser le compteur de likes
      comment.likesCount = 0;
      console.log(`  🔄 Compteur likes réinitialisé`);
      
      // Effectuer le soft delete avec gestion d'erreur
      try {
        console.log(`  🔄 Exécution du soft delete...`);
        await comment.softDelete();
        console.log(`  ✅ Soft delete terminé pour commentaire ${commentId}`);
      } catch (softDeleteError) {
        console.error('❌ Erreur lors du soft delete:', softDeleteError);
        return res.status(500).json({ message: 'Erreur lors de la suppression logique' });
      }
      
      res.json({ 
        message: 'Commentaire supprimé, les réponses sont conservées',
        deleted: true,
        hardDeleted: false
      });
    }

  } catch (error) {
    console.error('❌ ERREUR SUPPRESSION COMMENTAIRE:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ message: 'Erreur serveur', details: error.message });
  }
};

// Supprimer définitivement un commentaire soft-deleted
const forceDeleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;
    const isAdmin = req.user.role === 'admin';

    console.log(`💀 Tentative suppression définitive commentaire ${commentId} par ${req.user.email}`);

    // Vérifier que l'ID est valide
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      console.log(`❌ ID invalide: ${commentId}`);
      return res.status(400).json({ message: 'ID de commentaire invalide' });
    }

    // Récupérer le commentaire
    const comment = await Comment.findById(commentId);
    if (!comment) {
      console.log(`❌ Commentaire ${commentId} non trouvé`);
      return res.status(404).json({ message: 'Commentaire non trouvé' });
    }

    // Vérifier que le commentaire est bien soft-deleted
    if (!comment.isDeleted) {
      console.log(`❌ Commentaire ${commentId} n'est pas marqué comme supprimé`);
      return res.status(400).json({ message: 'Ce commentaire n\'est pas marqué comme supprimé' });
    }

    console.log(`📝 Commentaire soft-deleted trouvé - Author: ${comment.author}, User: ${userId}, Admin: ${isAdmin}`);

    // Vérifier les permissions (propriétaire ou admin)
    if (comment.author.toString() !== userId && !isAdmin) {
      console.log(`🚫 Permission refusée pour suppression définitive commentaire ${commentId}`);
      return res.status(403).json({ message: 'Non autorisé à supprimer définitivement ce commentaire' });
    }

    console.log(`✅ Permissions validées, suppression définitive...`);

    // Supprimer tous les likes du commentaire
    const deletedLikes = await Like.deleteMany({ 
      contentId: commentId, 
      contentType: 'comment' 
    });
    console.log(`  ❌ ${deletedLikes.deletedCount} likes supprimés`);

    // Supprimer le commentaire définitivement
    await Comment.findByIdAndDelete(commentId);
    console.log(`  ✅ Commentaire ${commentId} supprimé définitivement`);
    
    res.json({ 
      message: 'Commentaire supprimé définitivement',
      deleted: true,
      hardDeleted: true
    });

  } catch (error) {
    console.error('❌ ERREUR SUPPRESSION DÉFINITIVE COMMENTAIRE:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ message: 'Erreur serveur', details: error.message });
  }
};

export {

  getArticleComments,
  getReviewComments,
  createComment,
  deleteComment,
  forceDeleteComment

}; 