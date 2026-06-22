// ============================================
// Supabase Client — connects the app to your database
// ⚠️ Replace the two placeholder values below with your real ones from:
// Supabase Dashboard → Settings → API
// ============================================

const SUPABASE_URL = "https://jwprxvobiunfnucrrzuo.supabase.co";              // e.g. https://xxxxxxxx.supabase.co
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QaPnj3hornmsAdbHrVM92g_6HPfgUI6"; // the "Publishable key" (anon/public)

// Initialize the Supabase client (supabase-js library is loaded via CDN in each HTML file)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// ============================================
// Shipping line detection from container prefix
// First 4 letters of a container number identify the line
// ============================================
const PREFIX_TO_LINE = {
  // Maersk family
  MRKU: "MAERSK", MSKU: "MAERSK", MSDU: "MAERSK", MRSU: "MAERSK",
  SUDU: "MAERSK", SEAU: "MAERSK", HASU: "MAERSK", TRHU: "MAERSK",
  // Hapag-Lloyd
  TXGU: "HAPAG", HLXU: "HAPAG", HLCU: "HAPAG",
  // CMA CGM
  SEKU: "CMA CGM", CMAU: "CMA CGM", CGMU: "CMA CGM",
  // MSC
  MSCU: "MSC", MEDU: "MSC",
};

function detectShippingLine(containerNumber) {
  const prefix = containerNumber.trim().toUpperCase().slice(0, 4);
  return PREFIX_TO_LINE[prefix] || "UNKNOWN";
}

// Export for use in other files
window.AppDB = {
  supabaseClient,
  detectShippingLine,
};
