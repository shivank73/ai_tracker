# Lucid AI - Intelligence Dashboard

Lucid AI is a full-stack, personalized aggregator that fetches breaking artificial intelligence news from top tech publications, filters out the noise, and uses Google's Gemini AI to generate highly actionable, concise summaries. 

Built with a focus on clean UI and chronological integrity, the dashboard allows users to read news as it breaks or batch-process intelligence briefs at their own pace.

## 🚀 Features

* **Chronological AI Feed:** A real-time dashboard of AI-generated summaries, strictly ordered by the exact moment the AI processed them (`processedAt`), ensuring the newest insights are always at the top.
* **Intelligence Timeline:** A chronological stream of raw, breaking news ordered by when the scraper found them (`createdAt`). 
* **On-Demand Processing:** Users can run a batch processor to summarize multiple articles at once, or instantly summarize a single breaking article directly from the Timeline.
* **Smart Bookmarks (Read Later):** Save raw articles to a dedicated queue and process them into summaries when ready.
* **Automated Scraper:** Periodically pulls RSS feeds from TechCrunch, The Verge, NYT Tech, Ars Technica, arXiv, OpenAI, and JMLR, filtering specifically for AI keywords.
* **Secure Authentication:** Full JWT and bcrypt-backed user registration and login system.
* **Dark & Light Modes:** Seamless UI theme toggling with memory persistence.

## 🛠 Tech Stack

**Backend:**
* Node.js & Express.js
* MongoDB Atlas (Mongoose ODM)
* `rss-parser` (Data fetching)
* `@google/generative-ai` (Gemini 2.5 Flash Lite)
* `bcryptjs` & `jsonwebtoken` (Auth)

**Frontend:**
* Vanilla HTML5, CSS3, and JavaScript (ES6)
* RESTful API integrations
* CSS Variables for dynamic theme switching

## 🏗 Architecture Notes: The Chronology Engine

A core architectural feature of Lucid AI is how it handles time. 
* **`createdAt`:** Stamped the moment the RSS scraper finds an article. The **Timeline** sorts by this timestamp so users can see news as it breaks.
* **`processedAt`:** Stamped the exact millisecond the Gemini AI returns a summary. The **Feed** sorts by this timestamp. 

This decoupling ensures that if a user summarizes a 3-day-old article today, it appears at the absolute top of the Feed as "fresh intelligence," while remaining in its correct historical place on the Timeline.

## ⚙️ Local Setup & Installation

1. **Clone the repository**
   ```bash
   git clone [https://github.com/your-username/lucid-ai.git](https://github.com/your-username/lucid-ai.git)
   cd lucid-ai
