const { GoogleGenAI } = require('@google/genai');

// "-latest" alias tracks the current model — pinned ids get retired for
// new API users (gemini-2.5-flash already 404s on this key). flash-lite:
// scoped Q&A over a small JSON context doesn't need a bigger model, it
// answers in ~1s, and the full flash tier was seeing capacity 503s.
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || 20000;

const SYSTEM_INSTRUCTION = `You are the in-app assistant for VeriNest, a digital tenant verification platform.
You will receive a JSON context object containing ONLY the authenticated user's own data, followed by their question.

Rules you must always follow:
- Answer ONLY from the provided context JSON. It is your sole source of truth.
- If the answer is not present in the context, say "I don't have that information" and, where helpful, suggest what the user can do in the app instead.
- NEVER speculate about, invent, or reference any data outside the context — especially anything about other users, other tenants, other landlords, or their documents.
- If asked about another person's data, explain you can only help with the user's own account.
- Be concise and friendly. Amounts are in Indian Rupees (Rs.).`;

let client = null;
const getClient = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
};

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      const t = setTimeout(() => reject(new Error(`Gemini request timed out after ${ms}ms`)), ms);
      t.unref();
    }),
  ]);

/**
 * Asks Gemini the user's question with their scoped context as the only
 * data source. Throws on API failure/timeout — callers translate that
 * into a graceful 503.
 */
const askWithContext = async (question, contextJson) => {
  const contents = `Context (the authenticated user's own data):\n${JSON.stringify(contextJson, null, 2)}\n\nUser question: ${question}`;

  const response = await withTimeout(
    getClient().models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    }),
    TIMEOUT_MS
  );

  const text = response.text;
  if (!text) throw new Error('Gemini returned an empty response');
  return text.trim();
};

module.exports = { askWithContext };
