import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GoogleGenerativeAI,
  GoogleGenerativeAIError,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIResponseError,
} from '@google/generative-ai';

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY?.trim();

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

if (!GOOGLE_API_KEY) {
  console.warn('[Gemini] WARNING: GOOGLE_API_KEY is not set in .env');
}

const genAI = new GoogleGenerativeAI({ apiKey: GOOGLE_API_KEY });

function buildPrompt(question, systemInstruction) {
  if (systemInstruction) {
    return {
      systemInstruction,
      contents: [
        {
          role: 'user',
          parts: [{ text: question }],
        },
      ],
    };
  }

  return {
    contents: [
      {
        role: 'user',
        parts: [{ text: question }],
      },
    ],
  };
}

function formatError(error) {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  return String(error);
}

function isRetryableGeminiError(error) {
  const message = formatError(error).toLowerCase();

  return (
    message.includes('not found') ||
    message.includes('deprecated') ||
    message.includes('quota') ||
    message.includes('exceeded') ||
    message.includes('rate limit') ||
    message.includes('unavailable') ||
    message.includes('429') ||
    message.includes('503') ||
    error instanceof GoogleGenerativeAIFetchError ||
    error instanceof GoogleGenerativeAIResponseError ||
    error instanceof GoogleGenerativeAIError
  );
}

/**
 * Generate text using Gemini with fallback across models.
 * Returns the first successful model response.
 */
export async function generateGeminiText(
  question,
  {
    systemInstruction,
    temperature = 0.2,
    maxOutputTokens = 1024,
  } = {},
) {
  if (!GOOGLE_API_KEY) {
    throw new Error(
      'Missing GOOGLE_API_KEY. Create a .env file with GOOGLE_API_KEY=your_api_key_here',
    );
  }

  let lastError = null;

  for (const model of FALLBACK_MODELS) {
    console.log(`[Gemini] Using model: ${model}`);

    try {
      const modelClient = genAI.getGenerativeModel({ model });
      const request = buildPrompt(question, systemInstruction);
      request.generationConfig = {
        maxOutputTokens,
        temperature,
      };

      const result = await modelClient.generateContent(request);
      const text = result?.response?.text?.();

      if (!text || text.trim().length === 0) {
        throw new Error(`Model ${model} returned empty text response`);
      }

      return {
        model,
        text: text.trim(),
      };
    } catch (error) {
      lastError = error;
      console.warn(
        `[Gemini] Model ${model} failed. Switching to next model.`,
        formatError(error),
      );

      if (!isRetryableGeminiError(error) && model === FALLBACK_MODELS[FALLBACK_MODELS.length - 1]) {
        throw error;
      }

      continue;
    }
  }

  throw new Error(
    `All Gemini fallback models failed. Last error: ${formatError(lastError)}`,
  );
}

// Example CLI runner for local testing
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const question = process.argv.slice(2).join(' ');

  if (!question) {
    console.error('Usage: node src/services/geminiClient.js "Your question here"');
    process.exit(1);
  }

  generateGeminiText(question, {
    systemInstruction: 'You are a helpful study assistant. Answer clearly and concisely.',
  })
    .then((result) => {
      console.log('=== Gemini response ===');
      console.log('Model:', result.model);
      console.log('Text:', result.text);
    })
    .catch((error) => {
      console.error('Gemini generation failed:', error.message || error);
      process.exit(1);
    });
}
