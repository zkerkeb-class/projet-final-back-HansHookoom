import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: function() {
      return !this.isDeleted; // Requis seulement si pas supprimé
    },
    maxlength: 1000,
    trim: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  article: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: function() {
      return !this.review; // Requis si pas de review
    }
  },
  review: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review',
    required: function() {
      return !this.article; // Requis si pas d'article
    }
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null // null = commentaire principal, sinon = réponse
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  likesCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index pour optimiser les requêtes
commentSchema.index({ article: 1, createdAt: -1 });
commentSchema.index({ review: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1, createdAt: 1 });
commentSchema.index({ author: 1 });

// Méthode pour vérifier si le commentaire peut être supprimé définitivement
commentSchema.methods.canBeHardDeleted = async function() {
  const Comment = this.constructor;
  const repliesCount = await Comment.countDocuments({ parentComment: this._id });
  return repliesCount === 0;
};

// Méthode pour soft delete
commentSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.content = '';
  return this.save();
};

export default mongoose.model('Comment', commentSchema); 