// ============================================
// containers.js — Add / edit / archive / fetch containers
// Uses window.AppDB.supabaseClient directly (not cached at load time)
// so it works with the DOMContentLoaded timing in supabase-client.js
// ============================================

function getDB() {
  return window.AppDB.supabaseClient;
}

async function fetchActiveContainers() {
  const { data, error } = await getDB()
    .from("containers")
    .select("*, suppliers(name)")
    .order("eta", { ascending: true });
  if (error) { console.error("Error fetching containers:", error); return []; }
  return data;
}

async function fetchArchivedContainers() {
  const { data, error } = await getDB()
    .from("archived_containers")
    .select("*, suppliers(name)")
    .order("emptied_on", { ascending: false });
  if (error) { console.error("Error fetching archive:", error); return []; }
  return data;
}

async function fetchSuppliers() {
  const { data, error } = await getDB().from("suppliers").select("*").order("name");
  if (error) { console.error("Error fetching suppliers:", error); return []; }
  return data;
}

async function addSupplier(name) {
  const { data, error } = await getDB().from("suppliers").insert({ name }).select().single();
  if (error) return { success: false, message: error.message };
  return { success: true, supplier: data };
}

async function addContainers(containerRows) {
  const rowsWithDefaults = containerRows.map((row) => ({
    ...row,
    status: computeStatus(row.eta),
    created_by: sessionStorage.getItem("ct_role") || "unknown",
  }));
  const { data, error } = await getDB().from("containers").insert(rowsWithDefaults).select();
  if (error) return { success: false, message: error.message };
  return { success: true, containers: data };
}

async function updateContainer(id, updates) {
  const payload = { ...updates, updated_at: new Date().toISOString() };
  if (updates.eta) payload.status = computeStatus(updates.eta);
  const { data, error } = await getDB().from("containers").update(payload).eq("id", id).select().single();
  if (error) return { success: false, message: error.message };
  return { success: true, container: data };
}

async function deleteContainer(id) {
  const { error } = await getDB().from("containers").delete().eq("id", id);
  if (error) return { success: false, message: error.message };
  return { success: true };
}

async function markEmptied(containerRow) {
  const archiveRow = {
    container_number: containerRow.container_number,
    vessel: containerRow.vessel,
    eta: containerRow.eta,
    shipping_line: containerRow.shipping_line,
    supplier_id: containerRow.supplier_id,
    recipient: containerRow.recipient,
    packing_list_url: containerRow.packing_list_url,
    packing_list_filename: containerRow.packing_list_filename,
    created_at: containerRow.created_at,
    emptied_on: new Date().toISOString().split("T")[0],
    emptied_by: sessionStorage.getItem("ct_role") || "unknown",
  };
  const { error: insertError } = await getDB().from("archived_containers").insert(archiveRow);
  if (insertError) return { success: false, message: insertError.message };
  const { error: deleteError } = await getDB().from("containers").delete().eq("id", containerRow.id);
  if (deleteError) return { success: false, message: deleteError.message };
  return { success: true };
}

function computeStatus(etaDateString) {
  if (!etaDateString) return "NOT ARRIVED";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const eta = new Date(etaDateString); eta.setHours(0, 0, 0, 0);
  return eta <= today ? "ARRIVED" : "NOT ARRIVED";
}

function formatFullDate(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNum = d.getDate();
  const suffix = (n) => {
    if (n >= 11 && n <= 13) return "th";
    switch (n % 10) { case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th"; }
  };
  return `${days[d.getDay()]}, ${dayNum}${suffix(dayNum)} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function groupIntoTimelineBuckets(containers) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today); in7Days.setDate(today.getDate() + 7);
  const endOfThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const buckets = {
    overdue:   { label: "Overdue / Arrived",     items: [], color: "var(--red-accent)" },
    thisWeek:  { label: "This week",             items: [], color: "#D69E2E" },
    thisMonth: { label: "This month",            items: [], color: "var(--blue-light)" },
    later:     { label: "Next month and beyond", items: [], color: "var(--grey-text-light)" },
  };

  containers.forEach((c) => {
    if (!c.eta) { buckets.later.items.push(c); return; }
    const eta = new Date(c.eta); eta.setHours(0, 0, 0, 0);
    const daysAway = Math.round((eta - today) / 86400000);
    let key;
    if (eta <= today)              key = "overdue";
    else if (eta <= in7Days)       key = "thisWeek";
    else if (eta <= endOfThisMonth) key = "thisMonth";
    else                           key = "later";
    buckets[key].items.push({ ...c, daysAway });
  });
  return buckets;
}

function countdownLabel(daysAway) {
  if (daysAway === 0)  return "Arrives today";
  if (daysAway === 1)  return "Arrives tomorrow";
  if (daysAway > 1)   return `Arrives in ${daysAway} days`;
  if (daysAway === -1) return "Arrived yesterday";
  return `Arrived ${Math.abs(daysAway)} days ago`;
}

window.Containers = {
  fetchActiveContainers, fetchArchivedContainers, fetchSuppliers,
  addSupplier, addContainers, updateContainer, deleteContainer, markEmptied,
  computeStatus, formatFullDate, groupIntoTimelineBuckets, countdownLabel,
};
