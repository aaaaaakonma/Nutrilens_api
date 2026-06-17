const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://pnlkxpeqkvoodrhokaea.supabase.co';
// Use service role key to bypass RLS if configured, otherwise use anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_5rYJvpfl9qcYdixA0Ezdjw_tXcTUV_d';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

/**
 * Verifies the bearer JWT token from the Authorization header using Supabase Auth.
 * Returns the verified user object.
 */
async function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or malformed authorization header');
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error('Invalid or expired session token');
  }
  return user;
}

module.exports = {
  supabase,
  verifyToken
};
