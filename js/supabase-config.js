
// Supabase Configuration
// TODO: Replace these placeholders with your actual Supabase Project URL and Anon Key
const SUPABASE_URL = 'https://mtrgrzdseipzdsdjihzs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9l5Yd4DO7yXXbqVtpcXeJQ_wRaKu08b';

// Initialize Supabase Client
// Ensure the Supabase JS library is loaded in the HTML before this script runs
if (typeof supabase === 'undefined') {
    console.error('Supabase JS SDK not loaded!');
}

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other files (though in vanilla JS, _supabase is global if this runs, 
// but we'll assign it to window.sb for clarity or just use _supabase)
window.sb = _supabase;
