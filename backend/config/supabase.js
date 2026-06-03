const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUBABASE_URL; //[] https://rjodxfpfjchrrbeubfak.supabase.com;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL y SUPABASE_KEY son obligatorios');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

module.exports = supabase;
