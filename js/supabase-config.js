
// Supabase Configuration
// Supabase Configuration
// IMPORTANT: Get your Project URL and Anon Key from:
// Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'; // Replace with your Project URL
const SUPABASE_ANON_KEY = 'your_anon_public_key'; // Replace with your Service Role Key (anon public)


// Initialize Supabase Client
// Ensure the Supabase JS library is loaded in the HTML before this script runs
if (typeof supabase === 'undefined') {
    console.error('Supabase JS SDK not loaded!');
}

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other files
window.SUPABASE_URL = SUPABASE_URL;
window.sb = _supabase;
