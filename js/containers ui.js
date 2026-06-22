// ============================================
// containers-ui.js — Dashboard rendering & interactions
// Handles: table view, timeline view, detail panel, add-containers modal flow
// ============================================

let allContainers = [];
let allSuppliers = [];
let activeDetailId = null;

async function initDashboard() {
  showLoading("Loading your containers...", "Fetching from the database");
  allSuppliers = await Containers.fetchSuppliers();
  allContainers = await Containers.fetchActiveContainers();
  populateSupplierFilter();
  hideLoading();
  renderTable();
  updateStats();
}

function showLoading(title, sub) {
  const screen = document.getElementById("loadingScreen");
  if (!screen) return;
  document.getElementById("loadingTitle").textContent = title;
  document.getElementById("loadingSub").textContent = sub;
  screen.classList.remove("hidden");
}
function hideLoading() {
  const screen = document.getElementById("loadingScreen");
  if (screen) screen.classList.add("hidden");
}

function populateSupplierFilter() {
  const select = document.getElementById("filterSupplier");
  if (!select) return;
  allSuppliers.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    select.appendChild(opt);
  });
}

function updateStats() {
  const total = allContainers.length;
  const arrived = allContainers.filter((c) => c.status === "ARRIVED").length;
  const notArrived = total - arrived;

  document.getElementById("statActive").textContent = total;
  document.getElementById("statActiveSub").textContent = `across ${allSuppliers.length} suppliers`;
  document.getElementById("statArrived").textContent = arrived;
  document.getElementById("statNotArrived").textContent = notArrived;

  Containers.fetchArchivedContainers().then((archived) => {
    document.getElementById("statArchived").textContent = archived.length;
  });
}

function getFilteredContainers() {
  const q = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const supplierFilter = document.getElementById("filterSupplier")?.value || "";
  const statusFilter = document.getElementById("filterStatus")?.value || "";

  return allContainers.filter((c) => {
    if (q) {
      const haystack = `${c.container_number} ${c.vessel || ""} ${c.suppliers?.name || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (supplierFilter && c.supplier_id !== supplierFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    return true;
  });
}

function renderTable() {
  const container = document.getElementById("contentArea");
  if (!container) return;

  const filtered = getFilteredContainers();

  if (filtered.length === 0) {
    container.innerHTML = renderEmptyState();
    return;
  }

  container.innerHTML = currentView === "timeline"
    ? renderTimelineView(filtered)
    : renderSupplierView(filtered);
}

function renderEmptyState() {
  return `
    <div class="empty-state">
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
    </div>
  `;
}

function renderSupplierView(containers) {
  const grouped = {};
  containers.forEach((c) => {
    const supplierName = c.suppliers ? c.suppliers.name : "Unassigned";
    if (!grouped[supplierName]) grouped[supplierName] = [];
    grouped[supplierName].push(c);
  });

  let html = '<div class="table-wrap">';
  Object.entries(grouped).forEach(([supplierName, rows], idx) => {
    html += `
      <div class="section-header" style="${idx > 0 ? 'border-top:0.5px solid var(--grey-border)' : ''}">
        <span class="section-name">${supplierName.toUpperCase()}</span>
        <span class="section-count">${rows.length} container${rows.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="t-head" style="grid-template-columns: 1.4fr 1.5fr 1.9fr 0.9fr 0.85fr 0.9fr">
        <div class="th">Container no.</div>
        <div class="th">Vessel</div>
        <div class="th">ETA</div>
        <div class="th">Line</div>
        <div class="th">Status</div>
        <div class="th">Packing list</div>
      </div>
    `;
    rows.forEach((c) => { html += renderRow(c); });
    html += renderDetailPanel(rows);
  });
  html += "</div>";
  return html;
}

function renderTimelineView(containers) {
  const buckets = Containers.groupIntoTimelineBuckets(containers);
  let html = "";

  Object.entries(buckets).forEach(([key, bucket]) => {
    if (bucket.items.length === 0) return;
    html += `
      <div class="bucket">
        <div class="bucket-header">
          <span class="bucket-dot" style="background:${bucket.color}"></span>
          <span class="bucket-title">${bucket.label}</span>
          <span class="bucket-count">${bucket.items.length} container${bucket.items.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="table-wrap">
          <div class="t-head" style="grid-template-columns: 1.3fr 1.3fr 1.6fr 0.8fr 0.8fr 1fr">
            <div class="th">Container no.</div>
            <div class="th">Vessel</div>
            <div class="th">ETA</div>
            <div class="th">Supplier</div>
            <div class="th">Line</div>
            <div class="th">Countdown</div>
          </div>
          ${bucket.items.map((c) => renderTimelineRow(c, key)).join("")}
        </div>
      </div>
    `;
  });

  return html || renderEmptyState();
}

function renderRow(c) {
  const statusClass = c.status === "ARRIVED" ? "arrived" : "pending";
  const statusColor = c.status === "ARRIVED" ? "var(--green-accent)" : "var(--red-accent)";
  const plHtml = c.packing_list_url
    ? `<span class="pl-btn uploaded" onclick="event.stopPropagation(); viewPackingList('${c.id}')">View / Download</span>`
    : `<span class="pl-missing">No file yet</span>`;

  return `
    <div class="t-row" style="grid-template-columns: 1.4fr 1.5fr 1.9fr 0.9fr 0.85fr 0.9fr" onclick="toggleDetail('${c.id}')">
      <div class="mono">${c.container_number}</div>
      <div class="muted">${c.vessel || "—"}</div>
      <div class="muted">${Containers.formatFullDate(c.eta)}</div>
      <div class="muted">${c.shipping_line || "—"}</div>
      <div><span class="badge ${statusClass}"><span class="ind" style="background:${statusColor}"></span>${c.status === "ARRIVED" ? "Arrived" : "Not arrived"}</span></div>
      <div>${plHtml}</div>
    </div>
  `;
}

function renderTimelineRow(c, bucketKey) {
  const chipClass = bucketKey === "overdue" ? "overdue" : bucketKey === "thisWeek" ? "soon" : bucketKey === "thisMonth" ? "later" : "far";
  return `
    <div class="t-row" style="grid-template-columns: 1.3fr 1.3fr 1.6fr 0.8fr 0.8fr 1fr" onclick="toggleDetail('${c.id}')">
      <div class="mono">${c.container_number}</div>
      <div class="muted">${c.vessel || "—"}</div>
      <div class="muted">${Containers.formatFullDate(c.eta)}</div>
      <div class="muted">${c.suppliers ? c.suppliers.name : "—"}</div>
      <div class="muted">${c.shipping_line || "—"}</div>
      <div><span class="countdown-chip ${chipClass}">${Containers.countdownLabel(c.daysAway)}</span></div>
    </div>
  `;
}

function renderDetailPanel(rows) {
  if (!activeDetailId) return "";
  const c = rows.find((r) => r.id === activeDetailId);
  if (!c) return "";

  const plSection = c.packing_list_url
    ? `
      <div class="pl-file-row">
        <div class="pl-file-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div style="flex:1">
          <div class="pl-file-name">${c.packing_list_filename || "Packing list"}</div>
          <div class="pl-file-meta">Uploaded</div>
        </div>
        <div class="pl-action-btns">
          <button class="pl-action-btn" onclick="viewPackingList('${c.id}')">View</button>
          <button class="pl-action-btn editor-only" onclick="document.getElementById('plUpload_${c.id}').click()">Replace</button>
        </div>
      </div>
      <input type="file" id="plUpload_${c.id}" class="hidden" onchange="handlePackingListUpload(event, '${c.id}')">
    `
    : `
      <div class="pl-upload-area editor-only" onclick="document.getElementById('plUpload_${c.id}').click()">
        Click to upload the packing list (PDF, Word, or Excel)
      </div>
      <input type="file" id="plUpload_${c.id}" class="hidden" onchange="handlePackingListUpload(event, '${c.id}')">
      <div class="pl-missing" style="margin-top:8px; display:block">No packing list uploaded yet</div>
    `;

  return `
    <div class="detail-panel open">
      <div>
        <div class="detail-section-title">Shipment info</div>
        <div class="detail-card">
          <div class="detail-row"><span class="detail-key">Container</span><span class="detail-val mono">${c.container_number}</span></div>
          <div class="detail-row"><span class="detail-key">Vessel</span><span class="detail-val">${c.vessel || "—"}</span></div>
          <div class="detail-row"><span class="detail-key">ETA</span><span class="detail-val">${Containers.formatFullDate(c.eta)}</span></div>
          <div class="detail-row"><span class="detail-key">Shipping line</span><span class="detail-val">${c.shipping_line || "—"}</span></div>
          <div class="detail-row"><span class="detail-key">Supplier</span><span class="detail-val">${c.suppliers ? c.suppliers.name : "—"}</span></div>
          <div class="detail-row"><span class="detail-key">Recipient</span><span class="detail-val">${c.recipient || "WAGYINGO"}</span></div>
          <div class="detail-row"><span class="detail-key">Status</span><span class="detail-val" style="color:${c.status === 'ARRIVED' ? 'var(--green-text)' : 'var(--red-text)'}">${c.status === 'ARRIVED' ? 'Arrived' : 'Not arrived'}</span></div>
        </div>
        <div class="editor-only" style="display:flex; gap:8px; margin-top:10px">
          <button class="btn" onclick="openEditModal('${c.id}')">Edit</button>
          <button class="btn" style="color:#1D4ED8; border-color:#BFDBFE" onclick="handleMarkEmptied('${c.id}')">Mark emptied</button>
          <button class="btn" style="color:var(--red-text); border-color:#F7C1C1" onclick="handleDeleteContainer('${c.id}')">Remove</button>
        </div>
      </div>
      <div>
        <div class="detail-section-title">Packing list</div>
        <div class="detail-card">${plSection}</div>
      </div>
    </div>
  `;
}

function toggleDetail(id) {
  activeDetailId = activeDetailId === id ? null : id;
  renderTable();
}

// ============================================
// Add containers modal (paste → lookup → review → confirm)
// ============================================

function openAddModal() {
  const supplierOptions = allSuppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-title">Add containers</div>
        <div class="modal-sub">Paste container numbers — one per line or comma separated. We'll look up the rest.</div>
        <div class="form-row">
          <label class="form-label">Container numbers</label>
          <textarea class="form-textarea" id="pasteInput" placeholder="MRKU3877867&#10;MRKU5521221&#10;TRHU5206816"></textarea>
        </div>
        <div class="form-grid">
          <div class="form-row">
            <label class="form-label">Assign to supplier</label>
            <select class="form-select" id="supplierSelect">${supplierOptions}</select>
          </div>
          <div class="form-row">
            <label class="form-label">Default recipient</label>
            <select class="form-select" id="recipientSelect">
              <option value="WAGYINGO">WAGYINGO</option>
              <option value="Lucy">Lucy</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="runLookupAndReview()">Look up containers →</button>
        </div>
      </div>
    </div>
  `;
}

let pendingReviewRows = [];

async function runLookupAndReview() {
  const raw = document.getElementById("pasteInput").value;
  const numbers = Lookup.parseContainerInput(raw);
  if (numbers.length === 0) {
    alert("Please paste at least one container number.");
    return;
  }

  const supplierId = document.getElementById("supplierSelect").value;
  const recipient = document.getElementById("recipientSelect").value;

  showLoading("Looking up your containers...", `Checking ${numbers.length} container${numbers.length > 1 ? "s" : ""} across shipping lines`);
  const results = await Lookup.lookupContainers(numbers);
  hideLoading();

  pendingReviewRows = results.map((r) => ({
    container_number: r.containerNumber,
    vessel: r.vessel,
    eta: r.eta,
    shipping_line: r.shippingLine,
    supplier_id: supplierId,
    recipient: recipient,
    auto: r.found,
  }));

  renderReviewModal();
}

function renderReviewModal() {
  const rowsHtml = pendingReviewRows.map((row, i) => `
    <div style="display:grid; grid-template-columns:1.3fr 1.4fr 1.3fr 0.9fr; gap:6px; padding:9px 12px; border-bottom:0.5px solid var(--grey-border); align-items:center">
      <div class="mono" style="font-size:11px">${row.container_number}</div>
      <input class="form-input" style="height:30px; font-size:11px; ${row.auto ? 'background:#EFF6FF; border-color:#BFDBFE; color:#1D4ED8' : ''}" value="${row.vessel}" onchange="pendingReviewRows[${i}].vessel = this.value">
      <input type="date" class="form-input" style="height:30px; font-size:11px; ${row.auto ? 'background:#EFF6FF; border-color:#BFDBFE; color:#1D4ED8' : ''}" value="${row.eta}" onchange="pendingReviewRows[${i}].eta = this.value">
      <select class="form-input" style="height:30px; font-size:11px" onchange="pendingReviewRows[${i}].shipping_line = this.value">
        ${["MAERSK", "HAPAG", "CMA CGM", "MSC", "UNKNOWN"].map((l) => `<option ${row.shipping_line === l ? "selected" : ""}>${l}</option>`).join("")}
      </select>
    </div>
  `).join("");

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal" style="max-width:680px" onclick="event.stopPropagation()">
        <div class="modal-title">Review results</div>
        <div class="modal-sub">${pendingReviewRows.length} container${pendingReviewRows.length !== 1 ? "s" : ""} processed. Blue fields were filled automatically — click any field to edit.</div>
        <div style="background:var(--bg-subtle); border:0.5px solid var(--grey-border); border-radius:10px; overflow:hidden; margin-bottom:8px">
          <div style="display:grid; grid-template-columns:1.3fr 1.4fr 1.3fr 0.9fr; gap:6px; padding:8px 12px; border-bottom:0.5px solid var(--grey-border); background:#fff">
            <div class="th">Container</div><div class="th">Vessel</div><div class="th">ETA</div><div class="th">Line</div>
          </div>
          ${rowsHtml}
        </div>
        <div style="font-size:11px; color:var(--grey-text-light); margin-bottom:14px">Note: rows without an ETA need one entered manually before saving.</div>
        <div class="modal-footer">
          <button class="btn" onclick="openAddModal()">Back</button>
          <button class="btn btn-primary" onclick="confirmSaveContainers()">Confirm & save all ${pendingReviewRows.length} →</button>
        </div>
      </div>
    </div>
  `;
}

async function confirmSaveContainers() {
  const missingEta = pendingReviewRows.filter((r) => !r.eta);
  if (missingEta.length > 0) {
    alert(`Please fill in the ETA for: ${missingEta.map((r) => r.container_number).join(", ")}`);
    return;
  }

  showLoading("Saving containers...", "Adding to your tracker");
  const payload = pendingReviewRows.map(({ auto, ...rest }) => rest);
  const result = await Containers.addContainers(payload);
  hideLoading();

  if (!result.success) {
    alert("Something went wrong saving containers: " + result.message);
    return;
  }

  closeModal();
  allContainers = await Containers.fetchActiveContainers();
  renderTable();
  updateStats();
}

function openEditModal(id) {
  const c = allContainers.find((x) => x.id === id);
  if (!c) return;
  const supplierOptions = allSuppliers.map((s) => `<option value="${s.id}" ${s.id === c.supplier_id ? "selected" : ""}>${s.name}</option>`).join("");

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" onclick="closeModalOnOverlay(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-title">Edit container</div>
        <div class="form-row"><label class="form-label">Container number</label><input class="form-input" id="editContainerNumber" value="${c.container_number}" style="font-family:monospace"></div>
        <div class="form-grid">
          <div class="form-row"><label class="form-label">Supplier</label><select class="form-select" id="editSupplier">${supplierOptions}</select></div>
          <div class="form-row"><label class="form-label">Shipping line</label>
            <select class="form-select" id="editLine">${["MAERSK","HAPAG","CMA CGM","MSC"].map((l) => `<option ${c.shipping_line === l ? "selected" : ""}>${l}</option>`).join("")}</select>
          </div>
        </div>
        <div class="form-row"><label class="form-label">Vessel</label><input class="form-input" id="editVessel" value="${c.vessel || ''}"></div>
        <div class="form-grid">
          <div class="form-row"><label class="form-label">ETA</label><input type="date" class="form-input" id="editEta" value="${c.eta || ''}"></div>
          <div class="form-row"><label class="form-label">Recipient</label>
            <select class="form-select" id="editRecipient">
              <option ${c.recipient === 'WAGYINGO' ? 'selected' : ''}>WAGYINGO</option>
              <option ${c.recipient === 'Lucy' ? 'selected' : ''}>Lucy</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="saveEdit('${id}')">Save changes</button>
        </div>
      </div>
    </div>
  `;
}

async function saveEdit(id) {
  const updates = {
    container_number: document.getElementById("editContainerNumber").value.trim().toUpperCase(),
    supplier_id: document.getElementById("editSupplier").value,
    shipping_line: document.getElementById("editLine").value,
    vessel: document.getElementById("editVessel").value,
    eta: document.getElementById("editEta").value,
    recipient: document.getElementById("editRecipient").value,
  };
  showLoading("Saving changes...", "");
  const result = await Containers.updateContainer(id, updates);
  hideLoading();
  if (!result.success) { alert("Could not save: " + result.message); return; }
  closeModal();
  allContainers = await Containers.fetchActiveContainers();
  renderTable();
  updateStats();
}

async function handleMarkEmptied(id) {
  const c = allContainers.find((x) => x.id === id);
  if (!c) return;
  if (!confirm(`Mark ${c.container_number} as emptied? It will move to the archive.`)) return;

  showLoading("Moving to archive...", "");
  const result = await Containers.markEmptied(c);
  hideLoading();
  if (!result.success) { alert("Could not archive: " + result.message); return; }

  activeDetailId = null;
  allContainers = await Containers.fetchActiveContainers();
  renderTable();
  updateStats();
}

async function handleDeleteContainer(id) {
  const c = allContainers.find((x) => x.id === id);
  if (!c) return;
  if (!confirm(`Remove ${c.container_number}? This cannot be undone.`)) return;

  showLoading("Removing...", "");
  const result = await Containers.deleteContainer(id);
  hideLoading();
  if (!result.success) { alert("Could not remove: " + result.message); return; }

  activeDetailId = null;
  allContainers = await Containers.fetchActiveContainers();
  renderTable();
  updateStats();
}

async function handlePackingListUpload(event, containerId) {
  const file = event.target.files[0];
  if (!file) return;

  showLoading("Uploading packing list...", file.name);
  const path = `${containerId}/${file.name}`;
  const { error: uploadError } = await window.AppDB.supabaseClient.storage
    .from("packing-lists")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    hideLoading();
    alert("Upload failed: " + uploadError.message);
    return;
  }

  const { data: urlData } = window.AppDB.supabaseClient.storage.from("packing-lists").getPublicUrl(path);

  const result = await Containers.updateContainer(containerId, {
    packing_list_url: urlData.publicUrl,
    packing_list_filename: file.name,
  });

  hideLoading();
  if (!result.success) { alert("Could not save file reference: " + result.message); return; }

  allContainers = await Containers.fetchActiveContainers();
  renderTable();
}

function viewPackingList(containerId) {
  const c = allContainers.find((x) => x.id === containerId);
  if (c && c.packing_list_url) window.open(c.packing_list_url, "_blank");
}

function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}
function closeModalOnOverlay(e) {
  if (e.target.classList.contains("modal-overlay")) closeModal();
}
