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

  // 2. Geolocation Lookup
  try {
    // Vercel attaches geo headers:
    const city = req.headers['x-vercel-ip-city'];
    const region = req.headers['x-vercel-ip-country-region'];
    const country = req.headers['x-vercel-ip-country'];

    if (city || region || country) {
      const locationParts = [];
      if (city) locationParts.push(decodeURIComponent(city));
      if (region) locationParts.push(decodeURIComponent(region));
      if (country) locationParts.push(decodeURIComponent(country));
      
      return res.status(200).json({
        location: locationParts.join(', '),
        source: 'vercel-geo-headers'
      });
    }

    // Fallback if headers are missing (e.g. running vercel dev locally)
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip && ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }

    // Node 18+ has global fetch built-in
    let lookupUrl = 'https://ipapi.co/json/';
    if (ip && ip !== '::1' && ip !== '127.0.0.1' && ip !== '::ffff:127.0.0.1') {
      lookupUrl = `https://ipapi.co/${ip}/json/`;
    }

    try {
      const response = await fetch(lookupUrl);
      if (response.ok) {
        const data = await response.json();
        const cityVal = data.city || '';
        const regionVal = data.region || '';
        const countryVal = data.country_name || '';
        const locationParts = [];
        if (cityVal) locationParts.push(cityVal);
        if (regionVal) locationParts.push(regionVal);
        if (countryVal) locationParts.push(countryVal);

        if (locationParts.length > 0) {
          return res.status(200).json({
            location: locationParts.join(', '),
            source: 'ipapi'
          });
        }
      }
    } catch (fetchErr) {
      console.warn('ipapi fetch failed:', fetchErr.message);
    }

    // Second fallback
    let lookupUrl2 = 'http://ip-api.com/json/';
    if (ip && ip !== '::1' && ip !== '127.0.0.1' && ip !== '::ffff:127.0.0.1') {
      lookupUrl2 = `http://ip-api.com/json/${ip}`;
    }

    try {
      const response2 = await fetch(lookupUrl2);
      if (response2.ok) {
        const data = await response2.json();
        const cityVal = data.city || '';
        const regionVal = data.regionName || '';
        const countryVal = data.country || '';
        const locationParts = [];
        if (cityVal) locationParts.push(cityVal);
        if (regionVal) locationParts.push(regionVal);
        if (countryVal) locationParts.push(countryVal);

        if (locationParts.length > 0) {
          return res.status(200).json({
            location: locationParts.join(', '),
            source: 'ip-api'
          });
        }
      }
    } catch (fetchErr2) {
      console.warn('ip-api fetch failed:', fetchErr2.message);
    }

    return res.status(200).json({
      location: 'Unknown Location',
      source: 'none'
    });

  } catch (error) {
    console.error('Location detection error:', error);
    return res.status(500).json({ error: `Failed to detect location: ${error.message}` });
  }
};
