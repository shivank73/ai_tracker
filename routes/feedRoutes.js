import express from 'express';
import RawPost from '../models/RawPost.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/articles - Main Feed (Only shows processed articles)
router.get('/articles', authenticateToken, async (req, res) => {
  try {
    const articles = await RawPost.find({
      userId: req.user.id,
      aiSummary: { $exists: true, $ne: '' }
    }).sort({ createdAt: -1 }).limit(50);

    const unprocessedCount = await RawPost.countDocuments({
      userId: req.user.id,
      $or: [{ aiSummary: { $exists: false } }, { aiSummary: '' }]
    });

    res.json({ articles, unprocessedCount });
  } catch (error) {
    console.error("Error fetching feed:", error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// GET /api/timeline - Timeline View (Shows all articles, processed or not)
router.get('/timeline', authenticateToken, async (req, res) => {
  try {
    const articles = await RawPost.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(articles);
  } catch (error) {
    console.error("Error fetching timeline:", error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// GET /api/bookmarks - Bookmarks View (Shows only archived articles)
router.get('/bookmarks', authenticateToken, async (req, res) => {
  try {
    const articles = await RawPost.find({
      userId: req.user.id,
      isArchived: true
    }).sort({ createdAt: -1 });
    res.json(articles);
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
});

// POST /api/toggle-like/:id - Toggles the heart/flag status
router.post('/toggle-like/:id', authenticateToken, async (req, res) => {
  try {
    const article = await RawPost.findOne({ _id: req.params.id, userId: req.user.id });
    if (!article) return res.status(404).json({ error: 'Article not found' });

    article.isLiked = !article.isLiked;
    await article.save();
    res.json({ isLiked: article.isLiked });
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// POST /api/archive/:id - Toggles the bookmark status
router.post('/archive/:id', authenticateToken, async (req, res) => {
  try {
    const article = await RawPost.findOne({ _id: req.params.id, userId: req.user.id });
    if (!article) return res.status(404).json({ error: 'Article not found' });

    article.isArchived = !article.isArchived;
    await article.save();
    res.json({ isArchived: article.isArchived });
  } catch (error) {
    console.error("Error toggling archive:", error);
    res.status(500).json({ error: 'Failed to archive' });
  }
});

export default router;