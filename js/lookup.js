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

const LOOKUP_URL = "https://jwprxvobiunfnucrrzuo.supabase.co/functions/v1/lookup-container";

async function lookupContainer(containerNumber) {
  const line = window.AppDB.detectShippingLine(containerNumber);
  if (line === "UNKNOWN") {
    return { containerNumber, vessel:"", eta:"", shippingLine:"", found:false };
  }
  try {
    const res = await fetch(LOOKUP_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ containerNumber, shippingLine: line }),
    });
    if (!res.ok) return { containerNumber, vessel:"", eta:"", shippingLine:line, found:false };
    const data = await res.json();
    return { containerNumber, vessel:data.vessel||"", eta:data.eta||"", shippingLine:line, found:!!data.vessel };
  } catch {
    return { containerNumber, vessel:"", eta:"", shippingLine:line, found:false };
  }
}

async function lookupContainers(numbers) {
  return Promise.all(numbers.map(n => lookupContainer(n)));
}

function parseContainerInput(raw) {
  return raw.split(/[\n,]+/).map(s=>s.trim().toUpperCase()).filter(s=>s.length>0);
}

window.Lookup = { lookupContainer, lookupContainers, parseContainerInput };
