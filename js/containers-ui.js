// containers-ui.js — Dashboard rendering & interactions

let allContainers = [];
let allSuppliers  = [];
let activeDetailId = null;
let currentView    = "supplier";

async function initDashboard() {
  showLoading("Loading your containers...", "Fetching from the database");
  try {
    allSuppliers  = await Containers.fetchSuppliers();
    allContainers = await Containers.fetchActiveContainers();
    populateSupplierFilter();
    updateStats();
    renderTable();
  } catch(e) {
    console.error("initDashboard error:", e);
  }
  hideLoading();
}

function showLoading(title, sub) {
  const s = document.getElementById("loadingScreen");
  if (!s) return;
  document.getElementById("loadingTitle").textContent = title;
  document.getElementById("loadingSub").textContent   = sub;
  s.classList.remove("hidden");
}
function hideLoading() {
  const s = document.getElementById("loadingScreen");
  if (s) s.classList.add("hidden");
}

function populateSupplierFilter() {
  const sel = document.getElementById("filterSupplier");
  if (!sel) return;
  allSuppliers.forEach(s => {
    const o = document.createElement("option");
    o.value = s.id; o.textContent = s.name;
    sel.appendChild(o);
  });
}

function updateStats() {
  const total    = allContainers.length;
  const arrived  = allContainers.filter(c => c.status === "ARRIVED").length;
  document.getElementById("statActive").textContent    = total;
  document.getElementById("statActiveSub").textContent = `across ${allSuppliers.length} suppliers`;
  document.getElementById("statArrived").textContent   = arrived;
  document.getElementById("statNotArrived").textContent = total - arrived;
  Containers.fetchArchivedContainers().then(a => {
    document.getElementById("statArchived").textContent = a.length;
  });
}

function setView(view) {
  currentView = view;
  document.getElementById("viewBySupplier").classList.toggle("active", view==="supplier");
  document.getElementById("viewByTimeline").classList.toggle("active", view==="timeline");
  renderTable();
}

function getFiltered() {
  const q   = (document.getElementById("searchInput")?.value||"").toLowerCase();
  const sup = document.getElementById("filterSupplier")?.value||"";
  const sta = document.getElementById("filterStatus")?.value||"";
  return allContainers.filter(c => {
    if (q && !`${c.container_number} ${c.vessel||""} ${c.suppliers?.name||""}`.toLowerCase().includes(q)) return false;
    if (sup && c.supplier_id !== sup) return false;
    if (sta && c.status !== sta) return false;
    return true;
  });
}

function renderTable() {
  const el = document.getElementById("contentArea");
  if (!el) return;
  const filtered = getFiltered();
  if (!filtered.length) { el.innerHTML = emptyStateHTML(); return; }
  el.innerHTML = currentView === "timeline" ? timelineHTML(filtered) : supplierHTML(filtered);
}

function emptyStateHTML() {
  return `<div class="empty-state">
    <div class="empty-illustration">
      <svg width="180" height="110" viewBox="0 0 180 110" fill="none">
        <rect x="10" y="72" width="160" height="32" rx="4" fill="#1F3864" stroke="#2A5A9F" stroke-width="1.2"/>
        <rect x="14" y="75" width="46" height="26" rx="2" fill="#E53E3E"/>
        <rect x="64" y="75" width="46" height="26" rx="2" fill="#D69E2E"/>
        <rect x="114" y="75" width="52" height="26" rx="2" fill="#276749"/>
        <rect x="22" y="38" width="136" height="36" rx="4" fill="#162D50" stroke="#2A5A9F" stroke-width="1.2"/>
        <rect x="26" y="41" width="40" height="30" rx="2" fill="#3182CE"/>
        <rect x="70" y="41" width="40" height="30" rx="2" fill="#E53E3E"/>
        <rect x="114" y="41" width="40" height="30" rx="2" fill="#D69E2E"/>
        <rect x="40" y="10" width="100" height="30" rx="4" fill="#1A3A6B" stroke="#2A5A9F" stroke-width="1.2"/>
        <rect x="44" y="13" width="28" height="24" rx="2" fill="#276749"/>
        <rect x="76" y="13" width="28" height="24" rx="2" fill="#E53E3E"/>
        <rect x="108" y="13" width="28" height="24" rx="2" fill="#3182CE"/>
      </svg>
    </div>
    <div class="empty-shadow"></div>
    <div class="empty-title">No containers found</div>
    <div class="empty-sub">Paste your container numbers and we'll fetch everything automatically</div>
    <button class="btn btn-primary editor-only" onclick="openAddModal()" style="margin-top:6px">+ Add your first container</button>
  </div>`;
}

function supplierHTML(containers) {
  const grouped = {};
  containers.forEach(c => {
    const name = c.suppliers?.name||"Unassigned";
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(c);
  });
  let html = '<div class="table-wrap">';
  Object.entries(grouped).forEach(([name, rows], idx) => {
    html += `
      <div class="section-header" ${idx>0?'style="border-top:0.5px solid var(--grey-border)"':''}>
        <span class="section-name">${name.toUpperCase()}</span>
        <span class="section-count">${rows.length} container${rows.length!==1?'s':''}</span>
      </div>
      <div class="t-head" style="grid-template-columns:1.4fr 1.5fr 1.9fr 0.9fr 0.85fr 0.9fr">
        <div class="th">Container no.</div><div class="th">Vessel</div><div class="th">ETA</div>
        <div class="th">Line</div><div class="th">Status</div><div class="th">Packing list</div>
      </div>`;
    rows.forEach(c => { html += rowHTML(c); });
    html += detailPanelHTML(rows);
  });
  html += "</div>";
  return html;
}

function timelineHTML(containers) {
  const buckets = Containers.groupIntoTimelineBuckets(containers);
  let html = "";
  Object.entries(buckets).forEach(([key, b]) => {
    if (!b.items.length) return;
    html += `<div class="bucket">
      <div class="bucket-header">
        <span class="bucket-dot" style="background:${b.color}"></span>
        <span class="bucket-title">${b.label}</span>
        <span class="bucket-count">${b.items.length} container${b.items.length!==1?'s':''}</span>
      </div>
      <div class="table-wrap">
        <div class="t-head" style="grid-template-columns:1.3fr 1.3fr 1.6fr 0.8fr 0.8fr 1fr">
          <div class="th">Container no.</div><div class="th">Vessel</div><div class="th">ETA</div>
          <div class="th">Supplier</div><div class="th">Line</div><div class="th">Countdown</div>
        </div>
        ${b.items.map(c => timelineRowHTML(c, key)).join("")}
      </div>
    </div>`;
  });
  return html || emptyStateHTML();
}

function rowHTML(c) {
  const sc = c.status==="ARRIVED"?"arrived":"pending";
  const ic = c.status==="ARRIVED"?"var(--green-accent)":"var(--red-accent)";
  const pl = c.packing_list_url
    ? `<span class="pl-btn" onclick="event.stopPropagation();viewPL('${c.id}')">📄 View / Download</span>`
    : `<span class="pl-missing">No file yet</span>`;
  return `<div class="t-row" style="grid-template-columns:1.4fr 1.5fr 1.9fr 0.9fr 0.85fr 0.9fr" onclick="toggleDetail('${c.id}')">
    <div class="mono">${c.container_number}</div>
    <div class="muted">${c.vessel||"—"}</div>
    <div class="muted">${Containers.formatFullDate(c.eta)}</div>
    <div class="muted">${c.shipping_line||"—"}</div>
    <div><span class="badge ${sc}"><span class="ind" style="background:${ic}"></span>${c.status==="ARRIVED"?"Arrived":"Not arrived"}</span></div>
    <div>${pl}</div>
  </div>`;
}

function timelineRowHTML(c, key) {
  const chip = key==="overdue"?"overdue":key==="thisWeek"?"soon":key==="thisMonth"?"later":"far";
  return `<div class="t-row" style="grid-template-columns:1.3fr 1.3fr 1.6fr 0.8fr 0.8fr 1fr" onclick="toggleDetail('${c.id}')">
    <div class="mono">${c.container_number}</div>
    <div class="muted">${c.vessel||"—"}</div>
    <div class="muted">${Containers.formatFullDate(c.eta)}</div>
    <div class="muted">${c.suppliers?.name||"—"}</div>
    <div class="muted">${c.shipping_line||"—"}</div>
    <div><span class="countdown-chip ${chip}">${Containers.countdownLabel(c.daysAway)}</span></div>
  </div>`;
}

function detailPanelHTML(rows) {
  if (!activeDetailId) return "";
  const c = rows.find(r => r.id === activeDetailId);
  if (!c) return "";
  const pl = c.packing_list_url
    ? `<div class="pl-file-row">
        <div style="width:28px;height:28px;background:#DBEAFE;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div style="flex:1"><div class="pl-file-name">${c.packing_list_filename||"Packing list"}</div></div>
        <div style="display:flex;gap:6px">
          <button class="pl-action-btn" onclick="viewPL('${c.id}')">View</button>
          <button class="pl-action-btn editor-only" onclick="document.getElementById('pu_${c.id}').click()">Replace</button>
        </div>
      </div>
      <input type="file" id="pu_${c.id}" class="hidden" onchange="uploadPL(event,'${c.id}')">`
    : `<div class="pl-upload-area editor-only" onclick="document.getElementById('pu_${c.id}').click()">
        Click to upload the packing list (PDF, Word, or Excel)
      </div>
      <input type="file" id="pu_${c.id}" class="hidden" onchange="uploadPL(event,'${c.id}')">
      <p style="font-size:10px;color:#D1D5DB;font-style:italic;margin-top:8px">No packing list uploaded yet</p>`;

  return `<div class="detail-panel">
    <div>
      <div class="detail-section-title">Shipment info</div>
      <div class="detail-card">
        <div class="detail-row"><span class="detail-key">Container</span><span class="detail-val mono">${c.container_number}</span></div>
        <div class="detail-row"><span class="detail-key">Vessel</span><span class="detail-val">${c.vessel||"—"}</span></div>
        <div class="detail-row"><span class="detail-key">ETA</span><span class="detail-val">${Containers.formatFullDate(c.eta)}</span></div>
        <div class="detail-row"><span class="detail-key">Shipping line</span><span class="detail-val">${c.shipping_line||"—"}</span></div>
        <div class="detail-row"><span class="detail-key">Supplier</span><span class="detail-val">${c.suppliers?.name||"—"}</span></div>
        <div class="detail-row"><span class="detail-key">Recipient</span><span class="detail-val">${c.recipient||"WAGYINGO"}</span></div>
        <div class="detail-row"><span class="detail-key">Status</span><span class="detail-val" style="color:${c.status==='ARRIVED'?'var(--green-text)':'var(--red-text)'}">${c.status==='ARRIVED'?'Arrived':'Not arrived'}</span></div>
      </div>
      <div class="editor-only" style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" onclick="openEditModal('${c.id}')">Edit</button>
        <button class="btn" style="color:#1D4ED8;border-color:#BFDBFE" onclick="doMarkEmptied('${c.id}')">Mark emptied</button>
        <button class="btn" style="color:var(--red-text);border-color:#F7C1C1" onclick="doDelete('${c.id}')">Remove</button>
      </div>
    </div>
    <div>
      <div class="detail-section-title">Packing list</div>
      <div class="detail-card">${pl}</div>
    </div>
  </div>`;
}

function toggleDetail(id) {
  activeDetailId = activeDetailId === id ? null : id;
  renderTable();
}

// ── ADD MODAL ──────────────────────────────
function openAddModal() {
  const opts = allSuppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join("");
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" onclick="closeModalOverlay(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-title">Add containers</div>
        <div class="modal-sub">Paste container numbers — one per line. We'll detect the shipping line automatically.</div>
        <div class="form-row">
          <label class="form-label">Container numbers</label>
          <textarea class="form-textarea" id="pasteInput" placeholder="MRKU3877867&#10;MRKU5521221&#10;TRHU5206816"></textarea>
        </div>
        <div class="form-grid">
          <div class="form-row">
            <label class="form-label">Supplier</label>
            <select class="form-select" id="supplierSel">${opts}</select>
          </div>
          <div class="form-row">
            <label class="form-label">Default recipient</label>
            <select class="form-select" id="recipientSel">
              <option value="WAGYINGO">WAGYINGO</option>
              <option value="Lucy">Lucy</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="runLookup()">Look up containers →</button>
        </div>
      </div>
    </div>`;
}

let pendingRows = [];

async function runLookup() {
  const raw      = document.getElementById("pasteInput").value;
  const numbers  = Lookup.parseContainerInput(raw);
  if (!numbers.length) { alert("Please paste at least one container number."); return; }
  const suppId   = document.getElementById("supplierSel").value;
  const recipient= document.getElementById("recipientSel").value;
  showLoading("Looking up containers...", `Checking ${numbers.length} container${numbers.length>1?"s":""}`);
  const results  = await Lookup.lookupContainers(numbers);
  hideLoading();
  pendingRows = results.map(r => ({
    container_number: r.containerNumber,
    vessel: r.vessel, eta: r.eta, shipping_line: r.shippingLine,
    supplier_id: suppId, recipient, auto: r.found,
  }));
  renderReviewModal();
}

function renderReviewModal() {
  const rowsHTML = pendingRows.map((r,i) => `
    <div style="display:grid;grid-template-columns:1.3fr 1.4fr 1.3fr 0.9fr;gap:6px;padding:9px 12px;border-bottom:0.5px solid var(--grey-border);align-items:center">
      <div class="mono" style="font-size:11px">${r.container_number}</div>
      <input class="form-input" style="height:30px;font-size:11px;${r.auto?'background:#EFF6FF;border-color:#BFDBFE;color:#1D4ED8':''}" value="${r.vessel}" onchange="pendingRows[${i}].vessel=this.value" placeholder="Vessel name">
      <input type="date" class="form-input" style="height:30px;font-size:11px;${r.auto?'background:#EFF6FF;border-color:#BFDBFE;color:#1D4ED8':''}" value="${r.eta}" onchange="pendingRows[${i}].eta=this.value">
      <select class="form-input" style="height:30px;font-size:11px" onchange="pendingRows[${i}].shipping_line=this.value">
        ${["MAERSK","HAPAG","CMA CGM","MSC","UNKNOWN"].map(l=>`<option ${r.shipping_line===l?"selected":""}>${l}</option>`).join("")}
      </select>
    </div>`).join("");

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" onclick="closeModalOverlay(event)">
      <div class="modal" style="max-width:680px" onclick="event.stopPropagation()">
        <div class="modal-title">Review & confirm</div>
        <div class="modal-sub">${pendingRows.length} container${pendingRows.length!==1?"s":""} found. Blue = auto-filled. Click any field to edit before saving.</div>
        <div style="background:var(--bg-subtle);border:0.5px solid var(--grey-border);border-radius:10px;overflow:hidden;margin-bottom:8px">
          <div style="display:grid;grid-template-columns:1.3fr 1.4fr 1.3fr 0.9fr;gap:6px;padding:8px 12px;border-bottom:0.5px solid var(--grey-border);background:#fff">
            <div class="th">Container</div><div class="th">Vessel</div><div class="th">ETA *required</div><div class="th">Line</div>
          </div>
          ${rowsHTML}
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="openAddModal()">Back</button>
          <button class="btn btn-primary" onclick="confirmSave()">Save all ${pendingRows.length} containers →</button>
        </div>
      </div>
    </div>`;
}

async function confirmSave() {
  const missing = pendingRows.filter(r => !r.eta);
  if (missing.length) { alert(`Please enter ETA for: ${missing.map(r=>r.container_number).join(", ")}`); return; }
  showLoading("Saving containers...", "Adding to your tracker");
  const payload = pendingRows.map(({auto,...r}) => r);
  const result  = await Containers.addContainers(payload);
  hideLoading();
  if (!result.success) { alert("Error saving: " + result.message); return; }
  closeModal();
  allContainers = await Containers.fetchActiveContainers();
  renderTable(); updateStats();
}

// ── EDIT MODAL ─────────────────────────────
function openEditModal(id) {
  const c   = allContainers.find(x => x.id===id);
  if (!c) return;
  const opts = allSuppliers.map(s=>`<option value="${s.id}" ${s.id===c.supplier_id?"selected":""}>${s.name}</option>`).join("");
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" onclick="closeModalOverlay(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-title">Edit container</div>
        <div class="form-row"><label class="form-label">Container number</label><input class="form-input" id="eNum" value="${c.container_number}" style="font-family:monospace"></div>
        <div class="form-grid">
          <div class="form-row"><label class="form-label">Supplier</label><select class="form-select" id="eSup">${opts}</select></div>
          <div class="form-row"><label class="form-label">Shipping line</label>
            <select class="form-select" id="eLine">${["MAERSK","HAPAG","CMA CGM","MSC"].map(l=>`<option ${c.shipping_line===l?"selected":""}>${l}</option>`).join("")}</select></div>
        </div>
        <div class="form-row"><label class="form-label">Vessel</label><input class="form-input" id="eVes" value="${c.vessel||""}"></div>
        <div class="form-grid">
          <div class="form-row"><label class="form-label">ETA</label><input type="date" class="form-input" id="eEta" value="${c.eta||""}"></div>
          <div class="form-row"><label class="form-label">Recipient</label>
            <select class="form-select" id="eRec">
              <option ${c.recipient==="WAGYINGO"?"selected":""}>WAGYINGO</option>
              <option ${c.recipient==="Lucy"?"selected":""}>Lucy</option>
            </select></div>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="saveEdit('${id}')">Save changes</button>
        </div>
      </div>
    </div>`;
}

async function saveEdit(id) {
  const updates = {
    container_number: document.getElementById("eNum").value.trim().toUpperCase(),
    supplier_id: document.getElementById("eSup").value,
    shipping_line: document.getElementById("eLine").value,
    vessel: document.getElementById("eVes").value,
    eta: document.getElementById("eEta").value,
    recipient: document.getElementById("eRec").value,
  };
  showLoading("Saving...", "");
  const r = await Containers.updateContainer(id, updates);
  hideLoading();
  if (!r.success) { alert("Error: " + r.message); return; }
  closeModal();
  allContainers = await Containers.fetchActiveContainers();
  renderTable(); updateStats();
}

// ── ACTIONS ────────────────────────────────
async function doMarkEmptied(id) {
  const c = allContainers.find(x => x.id===id);
  if (!c || !confirm(`Mark ${c.container_number} as emptied? It will move to the archive.`)) return;
  showLoading("Moving to archive...", "");
  const r = await Containers.markEmptied(c);
  hideLoading();
  if (!r.success) { alert("Error: " + r.message); return; }
  activeDetailId = null;
  allContainers = await Containers.fetchActiveContainers();
  renderTable(); updateStats();
}

async function doDelete(id) {
  const c = allContainers.find(x => x.id===id);
  if (!c || !confirm(`Remove ${c.container_number}? This cannot be undone.`)) return;
  showLoading("Removing...", "");
  const r = await Containers.deleteContainer(id);
  hideLoading();
  if (!r.success) { alert("Error: " + r.message); return; }
  activeDetailId = null;
  allContainers = await Containers.fetchActiveContainers();
  renderTable(); updateStats();
}

async function uploadPL(event, id) {
  const file = event.target.files[0];
  if (!file) return;
  showLoading("Uploading packing list...", file.name);
  const path = `${id}/${file.name}`;
  const { error } = await window.AppDB.supabaseClient.storage.from("packing-lists").upload(path, file, { upsert: true });
  if (error) { hideLoading(); alert("Upload failed: " + error.message); return; }
  const { data } = window.AppDB.supabaseClient.storage.from("packing-lists").getPublicUrl(path);
  const r = await Containers.updateContainer(id, { packing_list_url: data.publicUrl, packing_list_filename: file.name });
  hideLoading();
  if (!r.success) { alert("Error saving file: " + r.message); return; }
  allContainers = await Containers.fetchActiveContainers();
  renderTable();
}

function viewPL(id) {
  const c = allContainers.find(x => x.id===id);
  if (c?.packing_list_url) window.open(c.packing_list_url, "_blank");
}

function closeModal() { document.getElementById("modalRoot").innerHTML = ""; }
function closeModalOverlay(e) { if (e.target.classList.contains("modal-overlay")) closeModal(); }
