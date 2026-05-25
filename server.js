import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import feedRoutes from './routes/feedRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Global Middleware
app.use(express.json()); 
app.use(express.static('public'));

// Mount Routes (Prefixing with /api automatically here!)
app.use('/api', authRoutes);
app.use('/api', feedRoutes);
app.use('/api', aiRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});