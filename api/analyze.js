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
  const { type, text, image, mimeType } = req.body || {};
  if (!type || (type === 'text' && !text) || (type === 'image' && (!image || !mimeType))) {
    return res.status(400).json({ error: 'Bad Request. Missing required fields.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      generationConfig: { responseMimeType: 'application/json' },
    });

    let result;

    if (type === 'text') {
      const prompt = `
Analyze this food description: "${text}".
Estimate the macronutrient contents in grams (protein, fat, carbs) and micronutrient contents (fiber in grams, iron in milligrams, sodium in milligrams, calcium in milligrams, potassium in milligrams) for a reasonable standard serving size or the size specified in the text.
Return a JSON object containing the food name, protein, fat, carbs, fiber, iron, sodium, calcium, and potassium.
The JSON must follow this exact format:
{
  "name": "Short Name of the Food (e.g. Oatmeal with Bananas)",
  "protein": 12.5,
  "fat": 4.5,
  "carbs": 45.0,
  "fiber": 4.0,
  "iron": 1.8,
  "sodium": 5.0,
  "calcium": 25.0,
  "potassium": 150.0
}
Use double numbers for all nutrients. Be realistic. If the description is not food, estimate 0.0 for all nutrient values.
`;
      result = await model.generateContent(prompt);
    } else {
      // image mode
      let prompt = `
Analyze this food image. Estimate the macronutrient contents in grams (protein, fat, carbs) and micronutrient contents (fiber in grams, iron in milligrams, sodium in milligrams, calcium in milligrams, potassium in milligrams) for the entire portion shown in the image.
Return a JSON object containing the food name, protein, fat, carbs, fiber, iron, sodium, calcium, and potassium.
The JSON must follow this exact format:
{
  "name": "Short Name of the Food (e.g. Avocado Toast with Egg)",
  "protein": 15.0,
  "fat": 12.0,
  "carbs": 28.0,
  "fiber": 5.5,
  "iron": 2.1,
  "sodium": 340.0,
  "calcium": 45.0,
  "potassium": 280.0
}
Use double numbers for all nutrients. Be realistic. If there is no food in the image, estimate 0.0 for all nutrient values.
`;
      if (text && text.trim().length > 0) {
        prompt += `\nAdditional user description/context for accuracy: "${text}"`;
      }

      const imagePart = {
        inlineData: {
          data: image, // base64 string
          mimeType: mimeType,
        },
      };

      result = await model.generateContent([prompt, imagePart]);
    }

    const response = await result.response;
    const responseText = response.text();

    if (!responseText) {
      throw new Error('Empty response received from Gemini.');
    }

    // Try parsing the response as valid JSON to make sure it's correct
    const parsedData = JSON.parse(responseText);
    return res.status(200).json(parsedData);

  } catch (error) {
    console.error('Gemini proxy error:', error);
    return res.status(500).json({ error: `Food analysis failed: ${error.message}` });
  }
};
