
// Supabase Configuration
// Supabase Configuration
// IMPORTANT: Get your Project URL and Anon Key from:
// Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL = 'https://mtrgrzdseipzdsdjihzs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9l5Yd4DO7yXXbqVtpcXeJQ_wRaKu08b';


// Initialize Supabase Client
// Ensure the Supabase JS library is loaded in the HTML before this script runs
if (typeof supabase === 'undefined') {
    console.error('Supabase JS SDK not loaded!');
}

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other files
window.SUPABASE_URL = SUPABASE_URL;
window.sb = _supabase;
