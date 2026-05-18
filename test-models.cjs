const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({path: '.env.local'});
require('dotenv').config({path: '.env'});
const apiKey = process.env.VITE_GOOGLE_API_KEY || process.env.VITE_GEMINI_API_KEY;

fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  .then(r => r.json())
  .then(data => {
    if (data.models) {
      console.log('Available models:', data.models.map(m => m.name).join(', '));
    } else {
      console.error(data);
    }
  }).catch(console.error);
