import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  contentType: {
    type: String,
    required: true,
    enum: ['article', 'review', 'comment']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index unique pour éviter les likes multiples du même utilisateur sur le même contenu
likeSchema.index({ user: 1, contentId: 1, contentType: 1 }, { unique: true });

// Méthodes statiques utiles
likeSchema.statics.getLikeCount = async function(contentId, contentType) {
  return await this.countDocuments({ contentId, contentType });
};

likeSchema.statics.isLikedByUser = async function(contentId, contentType, userId) {
  if (!userId) return false;
  const like = await this.findOne({ contentId, contentType, user: userId });
  return !!like;
};

likeSchema.statics.getLikesForContent = async function(contentId, contentType) {
  return await this.find({ contentId, contentType })
    .populate('user', 'username email')
    .sort({ createdAt: -1 });
};

export default mongoose.model('Like', likeSchema); 