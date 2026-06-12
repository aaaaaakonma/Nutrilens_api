const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');

module.exports = async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method not allowed. Use POST.' });
  }

  // 1. Validate Lease Token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Missing authorization token.' });
  }

  const token = authHeader.split(' ')[1];
  const serverSecret = process.env.INTERNAL_SECRET_KEY;

  if (!serverSecret) {
    return res.status(500).json({ error: 'Server configuration error: INTERNAL_SECRET_KEY is not set.' });
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return res.status(401).json({ error: 'Unauthorized. Malformed token.' });
    }

    const [expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    // Verify expiry
    if (isNaN(expiresAt) || expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Unauthorized. Lease token has expired.' });
    }

    // Verify signature
    const hmac = crypto.createHmac('sha256', serverSecret);
    hmac.update(expiresAtStr);
    const expectedSignature = hmac.digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Unauthorized. Invalid token signature.' });
    }
  } catch (err) {
    return res.status(401).json({ error: `Unauthorized. Token validation failed: ${err.message}` });
  }

  // 2. Validate Gemini API Key
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is not set.' });
  }

  // 3. Process Request
  const { message, history, context } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'Bad Request. Missing message field.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const systemInstruction = `You are NutriLens AI Advisor, a professional nutritionist and health coach.
Context about the user:
${context || 'No specific context provided.'}
Provide helpful, friendly, and actionable dietary advice, suggestions, and answers based on the user's profile, location, and weekly logs. Keep your answers relatively concise, encouraging, and focused on healthy habits.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      systemInstruction: systemInstruction,
    });

    // Map history to Google Generative AI format
    let formattedHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.message || msg.text || '' }]
    }));

    // Gemini requires the first turn to be from the 'user'.
    // We slice the history to start at the first 'user' message.
    const firstUserIdx = formattedHistory.findIndex(msg => msg.role === 'user');
    if (firstUserIdx !== -1) {
      formattedHistory = formattedHistory.slice(firstUserIdx);
    } else {
      formattedHistory = [];
    }

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const responseText = response.text();

    return res.status(200).json({ reply: responseText });

  } catch (error) {
    console.error('Gemini proxy chat error:', error);
    return res.status(500).json({ error: `Chat advice failed: ${error.message}` });
  }
};
