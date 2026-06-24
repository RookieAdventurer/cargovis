// ============================================
// Supabase Client — connects the app to your database
// ⚠️ Replace the two placeholder values below with your real ones from:
// Supabase Dashboard → Settings → API
// ============================================

const SUPABASE_URL = "https://jwprxvobiunfnucrrzuo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QaPnj3hornmsAdbHrVM92g_6HPfgUI6"; // keep your actual key

window.AppDB = {
  supabaseClient: null,
  detectShippingLine: function(containerNumber) {
    const PREFIX_TO_LINE = {
      MRKU: "MAERSK", MSKU: "MAERSK", MSDU: "MAERSK", MRSU: "MAERSK",
      SUDU: "MAERSK", SEAU: "MAERSK", HASU: "MAERSK", TRHU: "MAERSK",
      TXGU: "HAPAG", HLXU: "HAPAG", HLCU: "HAPAG",
      SEKU: "CMA CGM", CMAU: "CMA CGM", CGMU: "CMA CGM",
      MSCU: "MSC", MEDU: "MSC",
    };
    const prefix = containerNumber.trim().toUpperCase().slice(0, 4);
    return PREFIX_TO_LINE[prefix] || "UNKNOWN";
  }
};

// Wait for everything to load before creating the Supabase client
document.addEventListener("DOMContentLoaded", function() {
  if (window.supabase) {
    window.AppDB.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  } else {
    console.error("Supabase CDN not loaded");
  }
});
// Export for use in other files
window.AppDB = {
  supabaseClient,
  detectShippingLine,
};

