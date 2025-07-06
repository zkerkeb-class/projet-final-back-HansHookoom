import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  excerpt: { type: String },
  content: { type: String },
  image: { type: String },
  secondaryImage: { type: String },
  readingTime: { type: String },
  rating: { type: Number, min: 0, max: 10 },
  gameTitle: { type: String },
  platform: { type: String },
  genre: { type: String },
  likeCount: { type: Number, default: 0 },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Review', reviewSchema); 