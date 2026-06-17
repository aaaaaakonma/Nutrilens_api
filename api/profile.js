const { supabase, verifyToken } = require('./_supabase');

module.exports = async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  let user;
  try {
    user = await verifyToken(req);
  } catch (authError) {
    return res.status(401).json({ error: `Unauthorized: ${authError.message}` });
  }

  // --- GET Profile ---
  if (req.method === 'GET') {
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select()
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found.' });
      }

      return res.status(200).json(profile);
    } catch (err) {
      console.error('Error fetching profile:', err);
      return res.status(500).json({ error: `Internal server error: ${err.message}` });
    }
  }

  // --- POST Profile (Upsert) ---
  if (req.method === 'POST') {
    const {
      height,
      weight,
      targetBmi,
      gender,
      age,
      backendUrl,
      internalSecret,
      geminiApiKey
    } = req.body || {};

    try {
      const parsedHeight = parseFloat(height);
      const parsedWeight = parseFloat(weight);
      const parsedTargetBmi = parseFloat(targetBmi);
      const parsedAge = parseInt(age, 10);

      // Validate inputs
      if (isNaN(parsedHeight) || parsedHeight <= 0) {
        return res.status(400).json({ error: 'Invalid height value.' });
      }
      if (isNaN(parsedWeight) || parsedWeight <= 0) {
        return res.status(400).json({ error: 'Invalid weight value.' });
      }
      if (isNaN(parsedTargetBmi) || parsedTargetBmi <= 0) {
        return res.status(400).json({ error: 'Invalid target BMI value.' });
      }
      if (isNaN(parsedAge) || parsedAge <= 0 || parsedAge >= 125) {
        return res.status(400).json({ error: 'Invalid age value.' });
      }

      const upsertData = {
        user_id: user.id,
        height: parsedHeight,
        weight: parsedWeight,
        target_bmi: parsedTargetBmi,
        gender: gender || 'General',
        age: parsedAge,
        backend_url: backendUrl || '',
        internal_secret: internalSecret || '',
        gemini_api_key: geminiApiKey || ''
      };

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .upsert(upsertData)
        .select()
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json(profile);
    } catch (err) {
      console.error('Error saving profile:', err);
      return res.status(500).json({ error: `Internal server error: ${err.message}` });
    }
  }

  return res.status(455).json({ error: 'Method not allowed. Use GET or POST.' });
};
