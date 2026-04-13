import mongoose from 'mongoose';

const rawPostSchema = new mongoose.Schema({
  title: String,
  url: String,
  content: String,
  source: String,
  // --- NEW FIELDS BELOW ---
  aiSummary: String,
  isProcessed: { type: Boolean, default: false },
  isLiked: { type: Boolean, default: false }, 
  isArchived: { type: Boolean, default: false },
  // 👇 THE NEW MULTI-USER SANDBOX TIE-IN 👇
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // ------
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('RawPost', rawPostSchema);