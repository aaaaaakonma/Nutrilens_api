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

  const { secret } = req.body || {};
  
  // Fetch secret from environment variable
  const serverSecret = process.env.INTERNAL_SECRET_KEY;
  
  if (!serverSecret) {
    return res.status(500).json({ error: 'Server configuration error: INTERNAL_SECRET_KEY is not set.' });
  }

  if (!secret || secret !== serverSecret) {
    return res.status(401).json({ error: 'Unauthorized. Invalid secret key.' });
  }

  try {
    // Generate lease token (expires in 1 hour)
    const leaseDurationMs = 3600000; // 1 hour
    const expiresAt = Date.now() + leaseDurationMs;
    
    // Create HMAC signature
    const hmac = crypto.createHmac('sha256', serverSecret);
    hmac.update(expiresAt.toString());
    const signature = hmac.digest('hex');
    
    // Token structure: timestamp.signature
    const leaseToken = `${expiresAt}.${signature}`;

    return res.status(200).json({
      token: leaseToken,
      expiresAt: expiresAt,
    });
  } catch (error) {
    return res.status(500).json({ error: `Failed to generate lease token: ${error.message}` });
  }
};
