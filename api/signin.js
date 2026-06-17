const { supabase } = require('./_supabase');

module.exports = async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method not allowed. Use POST.' });
  }

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // 1. Sign in the user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const user = authData.user;
    if (!user) {
      return res.status(400).json({ error: 'Authentication failed. No user found.' });
    }

    // 2. Insert record to user_logins
    try {
      await supabase.from('user_logins').insert({
        user_id: user.id,
      });
    } catch (loginErr) {
      console.warn('Failed to insert user login log:', loginErr.message);
    }

    return res.status(200).json({
      session: authData.session,
      user: user
    });

  } catch (error) {
    console.error('Sign in error:', error);
    return res.status(500).json({ error: `Sign in failed: ${error.message}` });
  }
};
