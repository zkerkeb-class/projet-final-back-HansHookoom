import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: [20, 'Le pseudonyme ne peut pas dépasser 20 caractères']
  },
  role: { type: String, enum: ['visitor', 'admin'], default: 'visitor' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema); 