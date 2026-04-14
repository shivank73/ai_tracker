import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Parser from 'rss-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import RawPost from './models/RawPost.js';
import User from './models/User.js';     
import bcrypt from 'bcryptjs';           
import jwt from 'jsonwebtoken';          

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml; q=0.9, */*; q=0.8'
  }
});

app.use(express.json()); 
app.use(express.static('public'));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas!'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

const aiKeywords = [
  ' ai ', 'artificial intelligence', 'machine learning', 'llm', 'llms', 
  'gpt', 'openai', 'gemini', 'anthropic', 'claude', 'sora', 'deep learning', 
  'neural network', 'algorithm', 'robotics', 'sam altman', 'agi'
];

function isActuallyAI(text) {
  const lowerText = text.toLowerCase();
  return aiKeywords.some(keyword => lowerText.includes(keyword));
}

// ==========================================
// ROUTES: AUTHENTICATION
// ==========================================

app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already in use.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'User created successfully', token });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid email or password.' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Logged in successfully', token });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// ==========================================
// MIDDLEWARE: THE SECURITY BOUNCER
// ==========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied. Please log in.' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user; 
    next(); 
  });
};

// ==========================================
// ROUTES: DATA FETCHING & UI
// ==========================================

app.get('/api/articles', authenticateToken, async (req, res) => {
  try {
    // Sort strictly by when the AI finished generating the summary
    const articles = await RawPost.find({ isProcessed: true, userId: req.user.id }).sort({ processedAt: -1 });
    const unprocessedCount = await RawPost.countDocuments({ isProcessed: { $ne: true }, userId: req.user.id });
    
    res.json({ articles, unprocessedCount });
  } catch (error) {
    console.error("Feed Fetch Error:", error);
    res.status(500).json({ error: "Failed to load feed data." });
  }
});

app.get('/api/timeline', authenticateToken, async (req, res) => {
  try {
    // SCOPED: Only fetch timeline for this user
    const articles = await RawPost.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(articles);
  } catch (error) {
    console.error("Timeline Route Error:", error); 
    res.status(500).json({ error: "Failed to load timeline" });
  }
});

app.get('/api/bookmarks', authenticateToken, async (req, res) => {
  try {
    // SCOPED: Only fetch bookmarks for this user
    const bookmarks = await RawPost.find({ isArchived: true, userId: req.user.id }).sort({ createdAt: -1 });
    res.json(bookmarks);
  } catch (error) {
    console.error("Bookmarks Error:", error);
    res.status(500).json({ error: "Failed to load bookmarks" });
  }
});

// ==========================================
// ROUTES: ACTIONS & TOGGLES
// ==========================================

app.post('/api/toggle-like/:id', authenticateToken, async (req, res) => {
  try {
    // SCOPED: Ensure user only likes their own copies of articles
    const article = await RawPost.findOne({ _id: req.params.id, userId: req.user.id });
    if (!article) return res.status(404).send('Article not found');
    
    article.isLiked = !article.isLiked;
    await article.save();
    
    res.json({ success: true, isLiked: article.isLiked });
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

app.post('/api/archive/:id', authenticateToken, async (req, res) => {
  try {
    // SCOPED: Ensure user only archives their own copies
    const article = await RawPost.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!article) return res.status(404).json({ error: 'Article not found' });

    const newState = !article.isArchived;

    await RawPost.collection.updateOne(
      { _id: article._id }, 
      { $set: { isArchived: newState } }
    );

    res.json({ isArchived: newState });
  } catch (error) {
    console.error("Archive Toggle Error:", error);
    res.status(500).json({ error: "Failed to toggle archive status" });
  }
});

// ==========================================
// ROUTES: SCRAPING & AI PROCESSING
// ==========================================

app.get('/api/scrape', authenticateToken, async (req, res) => {
  try {
    const feeds = [
      { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch AI' },
      { url: 'https://www.theverge.com/rss/artificial-intelligence/index.xml', source: 'The Verge AI' },
      { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', source: 'NYT Tech' },
      { url: 'https://feeds.arstechnica.com/arstechnica/index', source: 'Ars Technica' },
      { url: 'http://export.arxiv.org/rss/cs.AI', source: 'arXiv (cs.AI)' },
      { url: 'https://openai.com/news/rss.xml', source: 'OpenAI News' },
      { url: 'http://www.jmlr.org/jmlr.xml', source: 'JMLR (Recent Papers)' }
    ];

    let newArticlesCount = 0;

    for (const feed of feeds) {
      try {
        const parsed = await parser.parseURL(feed.url);
        
        for (const item of parsed.items.slice(0, 10)) { 
          const contentStr = item.contentSnippet || item.content || item.description || "";
          const combinedText = `${item.title} ${contentStr}`;

          if (isActuallyAI(combinedText)) {
            // SCOPED: Check if this specific user already has this article
            const exists = await RawPost.findOne({ url: item.link, userId: req.user.id });
            if (!exists) {
              await RawPost.create({
                title: item.title,
                url: item.link,
                source: feed.source,
                content: contentStr || "No content provided.",
                userId: req.user.id // Assign ownership to the user scraping it!
              });
              newArticlesCount++;
            }
          }
        }
      } catch (feedErr) {
        console.warn(`Could not scrape ${feed.source}:`, feedErr.message);
      }
    }

    res.send(`Successfully fetched ${newArticlesCount} new verified AI intelligence briefings.`);
  } catch (error) {
    console.error("Scraper Error:", error);
    res.status(500).send('Critical failure during scraping operation.');
  }
});

app.get('/api/process', authenticateToken, async (req, res) => {
  try {
    const BATCH_SIZE = 3; 
    
    // SCOPED: Only process the current user's unprocessed articles
    const articlesToProcess = await RawPost.find({ 
      isProcessed: { $ne: true },
      userId: req.user.id 
    }).limit(BATCH_SIZE);

    if (articlesToProcess.length === 0) {
      return res.send("Queue is empty. No articles to process.");
    }

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    let processedCount = 0;

    for (const article of articlesToProcess) {
      const prompt = `
        You are a highly technical AI analyst. First, summarize this article in 2 concise, high-signal sentences focusing on breakthroughs, metrics, and actionable intelligence.
        
        Second, at the very end of your response, add a new line and include EXACTLY ONE or TWO of the following specific hashtags that best categorize the article:
        #AgenticAI, #NextGenModels, #GenAI, #PapersAndResearch, #MLResearch, #FutureOfWork, #OrgChanges, #AIEthics
        
        Title: ${article.title}
        Source: ${article.source}
        Content: ${article.content}
      `;

      let success = false;
      let attempts = 0;

      while (!success && attempts < 3) {
        try {

          const result = await model.generateContent(prompt);
          article.aiSummary = result.response.text();

        //  // --- 2. INJECT THE MOCK SUMMARY ---
        //   article.aiSummary = "MOCK SUMMARY: This is a fake AI summary to test the chronological feed sorting. #TestTag";

          article.isProcessed = true;
          article.processedAt = new Date(); // <-- ADD THIS LINE
          await article.save();
          
          success = true;
          processedCount++;
          
          console.log(`✅ Processed: ${article.title}`);
          await delay(10000); //1000
          
        } catch (err) {
          const errMsg = err.message ? err.message.toLowerCase() : "";
          
          if (err.status === 429 || errMsg.includes('429') || errMsg.includes('quota')) {
            attempts++;
            console.log(`⚠️ Rate limit hit. Server automatically waiting 35 seconds... (Attempt ${attempts}/3)`);
            await delay(35000); 
          } else {
            throw err; 
          }
        }
      }
    }

    res.send(`Successfully processed and categorized ${processedCount} articles.`);
  } catch (error) {
    console.error("Critical Processor Error:", error);
    res.status(500).send('Critical failure during AI processing. Check server logs.');
  }
});

app.post('/api/process-single/:id', authenticateToken, async (req, res) => {
  try {
    const targetArticle = await RawPost.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!targetArticle) {
      return res.status(404).send("Article not found in database.");
    }

    const prompt = `
      You are a highly technical AI analyst. First, summarize this article in 2 concise, high-signal sentences focusing on breakthroughs, metrics, and actionable intelligence.
      
      Second, at the very end of your response, add a new line and include EXACTLY ONE or TWO of the following specific hashtags that best categorize the article:
      #AgenticAI, #NextGenModels, #GenAI, #PapersAndResearch, #MLResearch, #FutureOfWork, #OrgChanges, #AIEthics
      
      Title: ${targetArticle.title}
      Source: ${targetArticle.source}
      Content: ${targetArticle.content}
    `;

    try {
      // Try to generate the content
      const result = await model.generateContent(prompt);
      targetArticle.aiSummary = result.response.text(); 
    
      // --- 2. INJECT THE MOCK SUMMARY ---
      // targetArticle.aiSummary = "MOCK SUMMARY: Single article clicked. This should instantly jump to the absolute top of the feed. #TestTag";
      

      targetArticle.isProcessed = true;    
      targetArticle.processedAt = new Date(); // <-- ADD THIS LINE       
      await targetArticle.save();

      res.status(200).json({ success: true, message: "Summary generated!" });

    } catch (aiError) {
      // 🚨 CATCH THE RATE LIMIT 🚨
      const errMsg = aiError.message ? aiError.message.toLowerCase() : "";
      if (aiError.status === 429 || errMsg.includes('429') || errMsg.includes('quota')) {
        console.warn("⚠️ Rate limit hit on single process.");
        // Send a specific 429 status code back to the frontend
        return res.status(429).json({ error: "AI is catching its breath. Please wait 30 seconds and try again." });
      }
      
      // If it's a different error, throw it to the main catch block
      throw aiError; 
    }

  } catch (error) {
    console.error("Single Process Error:", error);
    res.status(500).json({ error: "Failed to process article." });
  }
});

// ----------------------------------------------------
// TURN THE SERVER ON
// ----------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});