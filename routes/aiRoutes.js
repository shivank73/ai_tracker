import express from 'express';
import Parser from 'rss-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import RawPost from '../models/RawPost.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml; q=0.9, */*; q=0.8'
  }
});

const aiKeywords = [
  ' ai ', 'artificial intelligence', 'machine learning', 'llm', 'llms', 
  'gpt', 'openai', 'gemini', 'anthropic', 'claude', 'sora', 'deep learning', 
  'neural network', 'algorithm', 'robotics', 'sam altman', 'agi'
];

function isActuallyAI(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return aiKeywords.some(keyword => lowerText.includes(keyword));
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

// --- SCRAPER ROUTE ---
router.get('/scrape', authenticateToken, async (req, res) => {
  try {
    // Add or modify your RSS feed URLs here
    const feeds = [
      'https://techcrunch.com/category/artificial-intelligence/feed/',
      'https://www.theverge.com/rss/index.xml'
    ];

    let newArticlesCount = 0;

    for (const feedUrl of feeds) {
      try {
        const feed = await parser.parseURL(feedUrl);
        const items = feed.items.slice(0, 10); // Grab top 10 from each source

        for (const item of items) {
          const contentToSearch = (item.title + ' ' + (item.contentSnippet || '')).toLowerCase();
          
          if (isActuallyAI(contentToSearch)) {
            const exists = await RawPost.findOne({ url: item.link, userId: req.user.id });
            
            if (!exists) {
              await RawPost.create({
                userId: req.user.id,
                title: item.title,
                url: item.link,
                source: feed.title || 'Tech News',
                contentSnippet: item.contentSnippet || item.content || '',
                aiSummary: '', // Left blank to be processed later
                isLiked: false,
                isArchived: false
              });
              newArticlesCount++;
            }
          }
        }
      } catch (feedErr) {
        console.error(`Error parsing feed ${feedUrl}:`, feedErr.message);
      }
    }

    res.status(200).send(`Scraped ${newArticlesCount} new verified AI articles.`);
  } catch (error) {
    console.error('Scrape error:', error);
    res.status(500).json({ error: 'Failed to scrape articles.' });
  }
});

// --- BATCH PROCESS ROUTE ---
router.get('/process', authenticateToken, async (req, res) => {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    // Grab up to 3 unprocessed articles at a time
    const pendingArticles = await RawPost.find({ 
      userId: req.user.id, 
      $or: [{ aiSummary: { $exists: false } }, { aiSummary: '' }] 
    }).limit(3);

    if (pendingArticles.length === 0) {
      return res.status(200).send("No pending articles to process.");
    }

    let processedCount = 0;

    for (const article of pendingArticles) {
      try {
        const prompt = `You are an expert AI news analyst. Read the following article snippet and provide a 2-sentence summary of the breakthrough or news. Then, on a new line, add exactly 1-2 relevant hashtags from this list: #AgenticAI, #NextGenModels, #GenAI, #PapersAndResearch, #MLResearch, #FutureOfWork, #OrgChanges, #AIEthics. \n\nTitle: ${article.title}\nContent: ${article.contentSnippet}`;
        
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        article.aiSummary = text;
        await article.save();
        processedCount++;
        
      } catch (apiError) {
         if (apiError.status === 429) {
            console.log("Rate limit hit (429). Forcing a 35 second delay...");
            await delay(35000); // Wait out the rate limit
            break; 
         }
         console.error(`Error processing article ${article._id}:`, apiError);
      }
    }

    res.status(200).send(`Successfully analyzed and tagged ${processedCount} articles.`);
  } catch (error) {
    console.error('Process error:', error);
    res.status(500).json({ error: 'Failed to process articles.' });
  }
});

// --- SINGLE PROCESS ROUTE (Triggered from Timeline) ---
router.post('/process-single/:id', authenticateToken, async (req, res) => {
  try {
    const article = await RawPost.findOne({ _id: req.params.id, userId: req.user.id });
    if (!article) return res.status(404).json({ error: 'Article not found.' });

    if (article.aiSummary) {
       return res.json({ message: "Already processed.", article });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `You are an expert AI news analyst. Read the following article snippet and provide a 2-sentence summary of the breakthrough or news. Then, on a new line, add exactly 1-2 relevant hashtags from this list: #AgenticAI, #NextGenModels, #GenAI, #PapersAndResearch, #MLResearch, #FutureOfWork, #OrgChanges, #AIEthics. \n\nTitle: ${article.title}\nContent: ${article.contentSnippet}`;
        
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    article.aiSummary = text;
    await article.save();

    res.json({ message: "Successfully generated summary.", article });
  } catch (error) {
    console.error('Single process error:', error);
    res.status(500).json({ error: 'Failed to generate AI summary.' });
  }
});

export default router;