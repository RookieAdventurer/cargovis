// containers.js — All database operations
// Uses getDB() so the client is always fetched at call time, never at load time

function getDB() {
  if (!window.AppDB || !window.AppDB.supabaseClient) {
    throw new Error("Supabase client not ready");
  }
  return window.AppDB.supabaseClient;
}

async function fetchActiveContainers() {
  const { data, error } = await getDB().from("containers").select("*, suppliers(name)").order("eta", { ascending: true });
  if (error) { console.error(error); return []; }
  return data;
}

async function fetchArchivedContainers() {
  const { data, error } = await getDB().from("archived_containers").select("*, suppliers(name)").order("emptied_on", { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}

async function fetchSuppliers() {
  const { data, error } = await getDB().from("suppliers").select("*").order("name");
  if (error) { console.error(error); return []; }
  return data;
}

async function addSupplier(name) {
  const { data, error } = await getDB().from("suppliers").insert({ name }).select().single();
  if (error) return { success: false, message: error.message };
  return { success: true, supplier: data };
}

async function addContainers(rows) {
  const payload = rows.map(r => ({ ...r, status: computeStatus(r.eta), created_by: sessionStorage.getItem("ct_role") || "unknown" }));
  const { data, error } = await getDB().from("containers").insert(payload).select();
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

async function markEmptied(c) {
  const row = {
    container_number: c.container_number, vessel: c.vessel, eta: c.eta,
    shipping_line: c.shipping_line, supplier_id: c.supplier_id, recipient: c.recipient,
    packing_list_url: c.packing_list_url, packing_list_filename: c.packing_list_filename,
    created_at: c.created_at, emptied_on: new Date().toISOString().split("T")[0],
    emptied_by: sessionStorage.getItem("ct_role") || "unknown",
  };
  const { error: e1 } = await getDB().from("archived_containers").insert(row);
  if (e1) return { success: false, message: e1.message };
  const { error: e2 } = await getDB().from("containers").delete().eq("id", c.id);
  if (e2) return { success: false, message: e2.message };
  return { success: true };
}

function computeStatus(eta) {
  if (!eta) return "NOT ARRIVED";
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(eta); d.setHours(0,0,0,0);
  return d <= today ? "ARRIVED" : "NOT ARRIVED";
}

function formatFullDate(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const n = d.getDate();
  const sfx = (n>=11&&n<=13)?"th":{1:"st",2:"nd",3:"rd"}[n%10]||"th";
  return `${days[d.getDay()]}, ${n}${sfx} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function groupIntoTimelineBuckets(containers) {
  const today = new Date(); today.setHours(0,0,0,0);
  const in7 = new Date(today); in7.setDate(today.getDate()+7);
  const endMonth = new Date(today.getFullYear(), today.getMonth()+1, 0);
  const buckets = {
    overdue:   { label:"Overdue / Arrived",     items:[], color:"#DC2626" },
    thisWeek:  { label:"This week",             items:[], color:"#D69E2E" },
    thisMonth: { label:"This month",            items:[], color:"#93C5FD" },
    later:     { label:"Next month and beyond", items:[], color:"#9CA3AF" },
  };
  containers.forEach(c => {
    if (!c.eta) { buckets.later.items.push(c); return; }
    const eta = new Date(c.eta); eta.setHours(0,0,0,0);
    const days = Math.round((eta-today)/86400000);
    const key = eta<=today?"overdue":eta<=in7?"thisWeek":eta<=endMonth?"thisMonth":"later";
    buckets[key].items.push({ ...c, daysAway: days });
  });
  return buckets;
}

function countdownLabel(d) {
  if (d===0) return "Arrives today";
  if (d===1) return "Arrives tomorrow";
  if (d>1)   return `Arrives in ${d} days`;
  if (d===-1) return "Arrived yesterday";
  return `Arrived ${Math.abs(d)} days ago`;
}

window.Containers = {
  fetchActiveContainers, fetchArchivedContainers, fetchSuppliers,
  addSupplier, addContainers, updateContainer, deleteContainer, markEmptied,
  computeStatus, formatFullDate, groupIntoTimelineBuckets, countdownLabel,
};
