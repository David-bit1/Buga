const { createClient } = require('@supabase/supabase-js');

const rawUrl = process.env.SUPABASE_URL;
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!rawUrl || !rawKey) {
  console.error('❌ Missing Supabase env vars:', {
    hasUrl: !!rawUrl,
    hasKey: !!rawKey,
    urlPreview: rawUrl ? rawUrl.slice(0, 30) + '...' : 'undefined'
  });
  throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorios');
}

const supabaseUrl = rawUrl.trim();
const supabaseKey = rawKey.trim();

const isPublishableKey = (value) => String(value || '').startsWith('sb_publishable_');

if (isPublishableKey(supabaseKey)) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY no puede ser una key public/publishable (usa service_role)');
}

if (!/^https?:\/\//i.test(supabaseUrl)) {
  throw new Error(`SUPABASE_URL inválida: "${supabaseUrl}" - debe empezar con http:// o https://`);
}

console.log('✅ Supabase configured:', { url: supabaseUrl });

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

module.exports = supabase;
