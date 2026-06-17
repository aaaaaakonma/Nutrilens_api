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

  const { email, password, height, weight, targetBmi, age, gender } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // 1. Sign up the user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const user = authData.user;
    if (!user) {
      return res.status(400).json({ error: 'Failed to create user. Please try again.' });
    }

    // 2. Insert user profile statistics
    const parsedHeight = parseFloat(height) || 170.0;
    const parsedWeight = parseFloat(weight) || 65.0;
    const parsedTargetBmi = parseFloat(targetBmi) || 22.0;
    const parsedAge = parseInt(age, 10) || 25;
    const cleanGender = gender || 'General';

    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: user.id,
        height: parsedHeight,
        weight: parsedWeight,
        target_bmi: parsedTargetBmi,
        gender: cleanGender,
        age: parsedAge,
      });

    if (profileError) {
      console.error('Profile insertion error:', profileError);
      // Even if profile insert fails, return user session to avoid locked state
    }

    // 3. Insert record to user_logins
    try {
      await supabase.from('user_logins').insert({
        user_id: user.id,
      });
    } catch (loginErr) {
      console.warn('Failed to insert user login log:', loginErr.message);
    }

    return res.status(200).json({
      session: authData.session,
      user: user,
      profile: {
        userId: user.id,
        height: parsedHeight,
        weight: parsedWeight,
        targetBmi: parsedTargetBmi,
        gender: cleanGender,
        age: parsedAge,
      }
    });

  } catch (error) {
    console.error('Sign up error:', error);
    return res.status(500).json({ error: `Sign up failed: ${error.message}` });
  }
};
