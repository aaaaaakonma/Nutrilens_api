const { supabase, verifyToken } = require('./_supabase');

module.exports = async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
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

  // --- GET Entries ---
  if (req.method === 'GET') {
    try {
      const { data: entries, error } = await supabase
        .from('food_entries')
        .select()
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json(entries);
    } catch (err) {
      console.error('Error fetching food entries:', err);
      return res.status(500).json({ error: `Internal server error: ${err.message}` });
    }
  }

  // --- POST Entry (Upsert) ---
  if (req.method === 'POST') {
    const entry = req.body || {};

    if (!entry.id || !entry.name) {
      return res.status(400).json({ error: 'Missing entry id or name.' });
    }

    try {
      const payload = {
        id: entry.id,
        user_id: user.id,
        name: entry.name,
        protein: parseFloat(entry.protein) || 0.00,
        fat: parseFloat(entry.fat) || 0.00,
        carbs: parseFloat(entry.carbs) || 0.00,
        fiber: parseFloat(entry.fiber) || 0.00,
        iron: parseFloat(entry.iron) || 0.00,
        sodium: parseFloat(entry.sodium) || 0.00,
        calcium: parseFloat(entry.calcium) || 0.00,
        potassium: parseFloat(entry.potassium) || 0.00,
        logged_at: entry.timestamp || new Date().toISOString()
      };

      // Try full upsert with new micronutrient columns
      try {
        const { data, error } = await supabase
          .from('food_entries')
          .upsert(payload)
          .select();

        if (error) {
          throw error;
        }
        return res.status(200).json(data[0]);
      } catch (dbError) {
        console.warn('Upsert with micronutrients failed, falling back to basic macros:', dbError.message);
        
        // Fallback upsert (macro only)
        const fallbackPayload = {
          id: entry.id,
          user_id: user.id,
          name: entry.name,
          protein: parseFloat(entry.protein) || 0.00,
          fat: parseFloat(entry.fat) || 0.00,
          carbs: parseFloat(entry.carbs) || 0.00,
          logged_at: entry.timestamp || new Date().toISOString()
        };

        const { data, error: fallbackError } = await supabase
          .from('food_entries')
          .upsert(fallbackPayload)
          .select();

        if (fallbackError) {
          return res.status(400).json({ error: fallbackError.message });
        }
        return res.status(200).json(data[0]);
      }
    } catch (err) {
      console.error('Error saving food entry:', err);
      return res.status(500).json({ error: `Internal server error: ${err.message}` });
    }
  }

  // --- DELETE Entry/Entries ---
  if (req.method === 'DELETE') {
    const { id } = req.query || {};

    try {
      if (id) {
        // Delete single entry
        const { error } = await supabase
          .from('food_entries')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) {
          return res.status(400).json({ error: error.message });
        }
        return res.status(200).json({ success: true, message: `Entry ${id} deleted.` });
      } else {
        // Clear all entries for this user
        const { error } = await supabase
          .from('food_entries')
          .delete()
          .eq('user_id', user.id);

        if (error) {
          return res.status(400).json({ error: error.message });
        }
        return res.status(200).json({ success: true, message: 'All food entries cleared.' });
      }
    } catch (err) {
      console.error('Error deleting food entry:', err);
      return res.status(500).json({ error: `Internal server error: ${err.message}` });
    }
  }

  return res.status(455).json({ error: 'Method not allowed. Use GET, POST or DELETE.' });
};
