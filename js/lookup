// ============================================================
//  lookup.js — Shipping Line API Calls
//  Looks up vessel, ETA and status from official APIs
//  Maersk · Hapag-Lloyd · CMA CGM · MSC
// ============================================================

import { detectLine } from './app.js';

// ── API KEYS ──────────────────────────────────────────────────
// Add your API keys here once you register on each portal.
// Keep this file server-side (Supabase Edge Function) in production
// so keys are never exposed in the browser.
const KEYS = {
  maersk:  '',   // maersk.com/developer  →  "Shipment Tracking" product
  hapag:   '',   // developer.hapag-lloyd.com  →  "Track & Trace" API
  cmacgm:  '',   // apis.cma-cgm.com  →  "Tracking" API
  msc:     '',   // myMSC developer portal
};

// ── MAIN LOOKUP FUNCTION ──────────────────────────────────────
// Takes an array of container numbers, returns enriched results
export async function lookupContainers(containerNumbers) {
  const results = await Promise.allSettled(
    containerNumbers.map(no => lookupSingle(no))
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    // If lookup failed, return shell with detected line only
    return {
      container_no: containerNumbers[i],
      vessel:       '',
      eta:          '',
      line:         detectLine(containerNumbers[i]),
      status:       'lookup_failed',
      error:        result.reason?.message || 'Lookup failed',
    };
  });
}

// ── SINGLE CONTAINER LOOKUP ───────────────────────────────────
async function lookupSingle(containerNo) {
  const line = detectLine(containerNo);

  switch (line) {
    case 'Maersk':      return lookupMaersk(containerNo);
    case 'Hapag-Lloyd': return lookupHapag(containerNo);
    case 'CMA CGM':     return lookupCMACGM(containerNo);
    case 'MSC':         return lookupMSC(containerNo);
    default:            return unknownLine(containerNo, line);
  }
}

// ── MAERSK ────────────────────────────────────────────────────
// Docs: https://developer.maersk.com/product-catalogue/track-and-trace
// Register at maersk.com/developer → create app → subscribe to "Shipment Tracking"
async function lookupMaersk(containerNo) {
  if (!KEYS.maersk) return pendingKey(containerNo, 'Maersk');

  const res = await fetch(
    `https://api.maersk.com/track/v1/tracking/${containerNo}`,
    {
      headers: {
        'Consumer-Key': KEYS.maersk,
        'Accept':       'application/json',
      }
    }
  );

  if (!res.ok) throw new Error(`Maersk API error: ${res.status}`);
  const data = await res.json();

  // Parse Maersk response structure
  const vessel = data.containers?.[0]?.vesselName || '';
  const eta    = data.containers?.[0]?.eta
    ? data.containers[0].eta.split('T')[0]
    : '';

  return {
    container_no: containerNo,
    vessel,
    eta,
    line:   'Maersk',
    status: 'found',
  };
}

// ── HAPAG-LLOYD ───────────────────────────────────────────────
// Docs: https://developer.hapag-lloyd.com
// Register → create app → subscribe to "Track & Trace API"
async function lookupHapag(containerNo) {
  if (!KEYS.hapag) return pendingKey(containerNo, 'Hapag-Lloyd');

  const res = await fetch(
    `https://api.hapag-lloyd.com/tracking/v1/containers/${containerNo}`,
    {
      headers: {
        'x-api-key': KEYS.hapag,
        'Accept':    'application/json',
      }
    }
  );

  if (!res.ok) throw new Error(`Hapag-Lloyd API error: ${res.status}`);
  const data = await res.json();

  const vessel = data.vesselName || '';
  const eta    = data.estimatedTimeOfArrival
    ? data.estimatedTimeOfArrival.split('T')[0]
    : '';

  return {
    container_no: containerNo,
    vessel,
    eta,
    line:   'Hapag-Lloyd',
    status: 'found',
  };
}

// ── CMA CGM ───────────────────────────────────────────────────
// Docs: https://apis.cma-cgm.com
// Register → subscribe to "Container Tracking" API
async function lookupCMACGM(containerNo) {
  if (!KEYS.cmacgm) return pendingKey(containerNo, 'CMA CGM');

  const res = await fetch(
    `https://apis.cma-cgm.com/tracking/v1/containers/${containerNo}`,
    {
      headers: {
        'apikey':   KEYS.cmacgm,
        'Accept':   'application/json',
      }
    }
  );

  if (!res.ok) throw new Error(`CMA CGM API error: ${res.status}`);
  const data = await res.json();

  const vessel = data.containers?.[0]?.vessel?.vesselName || '';
  const eta    = data.containers?.[0]?.events
    ?.find(e => e.eventType === 'ESTIMATED_ARRIVAL')
    ?.eventDateTime?.split('T')[0] || '';

  return {
    container_no: containerNo,
    vessel,
    eta,
    line:   'CMA CGM',
    status: 'found',
  };
}

// ── MSC ───────────────────────────────────────────────────────
// Docs: https://www.msc.com/api
// Register at myMSC → developer portal → tracking API
async function lookupMSC(containerNo) {
  if (!KEYS.msc) return pendingKey(containerNo, 'MSC');

  const res = await fetch(
    `https://www.msc.com/api/tracking/container/${containerNo}`,
    {
      headers: {
        'Authorization': `Bearer ${KEYS.msc}`,
        'Accept':        'application/json',
      }
    }
  );

  if (!res.ok) throw new Error(`MSC API error: ${res.status}`);
  const data = await res.json();

  const vessel = data.vessel?.name || '';
  const eta    = data.eta
    ? data.eta.split('T')[0]
    : '';

  return {
    container_no: containerNo,
    vessel,
    eta,
    line:   'MSC',
    status: 'found',
  };
}

// ── FALLBACKS ─────────────────────────────────────────────────
// Returns a shell result when API key not yet configured
function pendingKey(containerNo, line) {
  return {
    container_no: containerNo,
    vessel:       '',
    eta:          '',
    line,
    status:       'pending_key',
    message:      `${line} API key not yet configured — enter vessel and ETA manually`,
  };
}

// Returns a shell result for unrecognised prefix
function unknownLine(containerNo, line) {
  return {
    container_no: containerNo,
    vessel:       '',
    eta:          '',
    line:         line || 'Unknown',
    status:       'unknown_line',
    message:      'Shipping line not recognised from prefix — enter details manually',
  };
}
