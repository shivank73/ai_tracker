const express = require('express');

const app = express();
const PORT = 3000;

// This tells the server how to respond when someone visits the main page
app.get('/', (req, res) => {
  res.send('My AI Tracker server is officially alive!');
});

// This turns the server on
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});