// supabase-client.js
const SUPABASE_URL = "https://jwprxvobiunfnucrrzuo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QaPnj3hornmsAdbHrVM92g_6HPfgUI6";

const PREFIX_TO_LINE = {
  MRKU:"MAERSK",MSKU:"MAERSK",MSDU:"MAERSK",MRSU:"MAERSK",
  SUDU:"MAERSK",SEAU:"MAERSK",HASU:"MAERSK",TRHU:"MAERSK",
  TXGU:"HAPAG",HLXU:"HAPAG",HLCU:"HAPAG",
  SEKU:"CMA CGM",CMAU:"CMA CGM",CGMU:"CMA CGM",
  MSCU:"MSC",MEDU:"MSC",
};

function detectShippingLine(containerNumber) {
  const prefix = containerNumber.trim().toUpperCase().slice(0, 4);
  return PREFIX_TO_LINE[prefix] || "UNKNOWN";
}

window.AppDB = {
  supabaseClient: window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY),
  detectShippingLine,
};
