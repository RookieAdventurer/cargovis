// ============================================
// lookup.js — Shipping line lookup abstraction layer
//
// This is the ONE place that talks to Maersk / Hapag-Lloyd / CMA CGM / MSC.
// If any of their APIs change later, we only need to fix it here —
// nothing else in the app needs to know which line a container belongs to.
//
// ⚠️ IMPORTANT: Calling these APIs directly from the browser would expose
// your API keys to anyone who opens dev tools. So actual API calls should
// go through a Supabase Edge Function (similar pattern to check-password).
// This file is the FRONTEND side: it calls that Edge Function, which then
// calls the real shipping line APIs server-side using your stored keys.
//
// Until that Edge Function ("lookup-container") is deployed, this file
// returns a clear "not configured yet" result so the rest of the app
// still works end-to-end with manual entry as a fallback.
// ============================================

// Replace with your real Supabase project URL (same one used elsewhere)
const LOOKUP_FUNCTION_URL = "https://jwprxvobiunfnucrrzuo.supabase.co/functions/v1/lookup-container";

/**
 * Looks up a single container number.
 * Returns: { containerNumber, vessel, eta, shippingLine, found, error }
 */
async function lookupContainer(containerNumber) {
  const shippingLine = window.AppDB.detectShippingLine(containerNumber);

  if (shippingLine === "UNKNOWN") {
    return {
      containerNumber,
      vessel: "",
      eta: "",
      shippingLine: "",
      found: false,
      error: "Could not detect shipping line from prefix. Enter details manually.",
    };
  }

  try {
    const res = await fetch(LOOKUP_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ containerNumber, shippingLine }),
    });

    if (!res.ok) {
      // Edge Function not deployed yet, or the carrier API failed —
      // fall back gracefully so the user can still type it in manually.
      return {
        containerNumber,
        vessel: "",
        eta: "",
        shippingLine,
        found: false,
        error: "Auto-lookup not available yet — enter details manually.",
      };
    }

    const data = await res.json();
    return {
      containerNumber,
      vessel: data.vessel || "",
      eta: data.eta || "",
      shippingLine,
      found: !!data.vessel,
      error: data.vessel ? null : "No tracking data found for this container yet.",
    };
  } catch (err) {
    return {
      containerNumber,
      vessel: "",
      eta: "",
      shippingLine,
      found: false,
      error: "Auto-lookup not available yet — enter details manually.",
    };
  }
}

/**
 * Looks up a batch of container numbers (from the paste box).
 * Runs lookups in parallel for speed.
 */
async function lookupContainers(containerNumbers) {
  const cleaned = containerNumbers
    .map((n) => n.trim().toUpperCase())
    .filter((n) => n.length > 0);

  const results = await Promise.all(cleaned.map((n) => lookupContainer(n)));
  return results;
}

/** Parses the paste box text into an array of container numbers. Accepts newlines or commas. */
function parseContainerInput(rawText) {
  return rawText
    .split(/[\n,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);
}

window.Lookup = { lookupContainer, lookupContainers, parseContainerInput };
