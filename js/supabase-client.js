// supabase-client.js
// Shared Supabase connection for all CargoVis pages.

(() => {
  const SUPABASE_URL = "https://jwprxvobiunfnucrrzuo.supabase.co";

  // Use your existing Supabase publishable key.
  const SUPABASE_KEY = "sb_publishable_QaPnj3hornmsAdbHrVM92g_6HPfgUI6";

  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("Supabase library has not loaded.");
  }

  window.AppDB = window.AppDB || {};

  if (!window.AppDB.supabaseClient) {
    window.AppDB.supabaseClient =
      window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
})();
