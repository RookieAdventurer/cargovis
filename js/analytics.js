// CargoVis Analytics
// Reads existing active and archived container records.
// Does not insert, update, or delete database records.

const analyticsDB = window.AppDB.supabaseClient;

let activeRecords = [];
let archivedRecords = [];

const numberFormat = new Intl.NumberFormat();

function formatNumber(value) {
  return numberFormat.format(value || 0);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function getSupplierName(record) {
  const supplier = record.suppliers;

  if (Array.isArray(supplier)) {
    return supplier[0]?.name || "Unassigned";
  }

  return supplier?.name || "Unassigned";
}

function getDateValue(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = getDateValue(value);

  if (!date) return "—";

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function isArrivalRecorded(record) {
  // Use arrival timestamps if present in the returned record.
  if (record.actual_arrival_at || record.arrived_at) {
    return true;
  }

  // Also recognise a saved status, while avoiding "NOT ARRIVED".
  const status = String(record.status || "")
    .trim()
    .toUpperCase();

  return (
    status.includes("ARRIVED") &&
    !status.includes("NOT ARRIVED")
  );
}

function getLastSixMonths() {
  const months = [];
  const now = new Date();

  for (let offset = 5; offset >= 0; offset--) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - offset,
      1
    );

    months.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      label: date.toLocaleDateString(undefined, {
        month: "short"
      }),
      count: 0
    });
  }

  return months;
}

function renderMonthlyChart(records, dateField, targetId, emptyMessage) {
  const months = getLastSixMonths();

  records.forEach(record => {
    const date = getDateValue(record[dateField]);

    if (!date) return;

    const month = months.find(item =>
      item.year === date.getFullYear() &&
      item.month === date.getMonth()
    );

    if (month) month.count++;
  });

  const target = document.getElementById(targetId);

  if (!months.some(month => month.count > 0)) {
    target.innerHTML = `<div class="analytics-empty">${emptyMessage}</div>`;
    return;
  }

  const maximum = Math.max(...months.map(month => month.count), 1);

  target.innerHTML = `
    <div class="bar-chart">
      ${months.map(month => {
        const height = month.count
          ? Math.max((month.count / maximum) * 100, 4)
          : 0;

        return `
          <div class="bar-column">
            <div class="bar-value">${formatNumber(month.count)}</div>
            <div class="bar-track">
              <div class="bar-fill" style="height:${height}%"></div>
            </div>
            <div class="bar-label">${escapeHTML(month.label)}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderBreakdown(records, getLabel, targetId, emptyMessage) {
  const target = document.getElementById(targetId);
  const totals = {};

  records.forEach(record => {
    const label = getLabel(record) || "Unassigned";
    totals[label] = (totals[label] || 0) + 1;
  });

  const entries = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (!entries.length) {
    target.innerHTML = `<div class="analytics-empty">${emptyMessage}</div>`;
    return;
  }

  const maximum = Math.max(...entries.map(entry => entry[1]), 1);

  target.innerHTML = `
    <div class="horizontal-list">
      ${entries.map(([label, count]) => `
        <div class="horizontal-item">
          <div class="horizontal-heading">
            <span title="${escapeHTML(label)}">${escapeHTML(label)}</span>
            <strong>${formatNumber(count)}</strong>
          </div>
          <div class="horizontal-track">
            <div class="horizontal-fill"
                 style="width:${(count / maximum) * 100}%"></div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function getEtaStatus(etaValue) {
  const eta = getDateValue(etaValue);

  if (!eta) {
    return {
      label: "No ETA",
      className: "normal"
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  eta.setHours(0, 0, 0, 0);

  const difference = Math.round(
    (eta.getTime() - today.getTime()) / 86400000
  );

  if (difference < 0) {
    return {
      label: `${Math.abs(difference)} day(s) past`,
      className: "overdue"
    };
  }

  if (difference <= 7) {
    return {
      label: difference === 0 ? "Due today" : `In ${difference} day(s)`,
      className: "soon"
    };
  }

  return {
    label: "Upcoming",
    className: "normal"
  };
}

function renderEtaWatchlist(records) {
  const target = document.getElementById("eta-watchlist");

  const watchlist = records
    .filter(record => record.eta && !isArrivalRecorded(record))
    .sort((a, b) => {
      return new Date(a.eta) - new Date(b.eta);
    });

  if (!watchlist.length) {
    target.innerHTML = `
      <tr>
        <td colspan="6" class="analytics-empty">
          No active containers with an outstanding ETA.
        </td>
      </tr>
    `;
    return;
  }

  target.innerHTML = watchlist.map(record => {
    const etaStatus = getEtaStatus(record.eta);

    return `
      <tr>
        <td><strong>${escapeHTML(record.container_number || "—")}</strong></td>
        <td>${escapeHTML(record.vessel || "—")}</td>
        <td>${escapeHTML(getSupplierName(record))}</td>
        <td>${escapeHTML(record.shipping_line || "—")}</td>
        <td>${formatDate(record.eta)}</td>
        <td>
          <span class="eta-tag ${etaStatus.className}">
            ${escapeHTML(etaStatus.label)}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

function renderInsights(records) {
  const target = document.getElementById("operational-insights");

  const total = records.length;
  const arrived = records.filter(isArrivalRecorded).length;
  const notArrived = total - arrived;

  const suppliers = {};
  const shippingLines = {};

  records.forEach(record => {
    const supplier = getSupplierName(record);
    const line = record.shipping_line || "Unassigned";

    suppliers[supplier] = (suppliers[supplier] || 0) + 1;
    shippingLines[line] = (shippingLines[line] || 0) + 1;
  });

  const topSupplier = Object.entries(suppliers)
    .sort((a, b) => b[1] - a[1])[0];

  const topLine = Object.entries(shippingLines)
    .sort((a, b) => b[1] - a[1])[0];

  const insights = [
    {
      icon: "📦",
      text: `${formatNumber(total)} container records are available across active and archived records.`
    },
    {
      icon: "🚢",
      text: `${formatNumber(arrived)} records have an arrival status or arrival timestamp. ${formatNumber(notArrived)} do not.`
    }
  ];

  if (topSupplier) {
    insights.push({
      icon: "🏭",
      text: `${topSupplier[0]} has the highest container count (${topSupplier[1]}).`
    });
  }

  if (topLine) {
    insights.push({
      icon: "⚓",
      text: `${topLine[0]} is the most frequently recorded shipping line (${topLine[1]}).`
    });
  }

  target.innerHTML = insights.map(insight => `
    <div class="insight-item">
      <span class="insight-icon">${insight.icon}</span>
      <span>${escapeHTML(insight.text)}</span>
    </div>
  `).join("");
}

function renderRecordSummary(active, archived) {
  const target = document.getElementById("record-summary");

  const total = active.length + archived.length;

  const items = [
    ["Active register", active.length],
    ["Archive register", archived.length],
    ["Combined records", total]
  ];

  target.innerHTML = items.map(([label, count]) => `
    <div class="insight-item">
      <span>📊</span>
      <span>
        <strong>${escapeHTML(label)}</strong><br>
        ${formatNumber(count)} container(s)
      </span>
    </div>
  `).join("");
}

function updateKpis(active, archived) {
  const overdue = active.filter(record => {
    if (!record.eta || isArrivalRecorded(record)) return false;

    const eta = getDateValue(record.eta);

    if (!eta) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eta.setHours(0, 0, 0, 0);

    return eta < today;
  }).length;

  document.getElementById("total-containers").textContent =
    formatNumber(active.length + archived.length);

  document.getElementById("active-containers").textContent =
    formatNumber(active.length);

  document.getElementById("archived-containers").textContent =
    formatNumber(archived.length);

  document.getElementById("overdue-containers").textContent =
    formatNumber(overdue);
}

function renderAnalytics() {
  const allRecords = [...activeRecords, ...archivedRecords];

  updateKpis(activeRecords, archivedRecords);

  renderMonthlyChart(
    allRecords,
    "created_at",
    "monthly-chart",
    "No creation-date data is available for the last six months."
  );

  renderMonthlyChart(
    archivedRecords,
    "emptied_on",
    "emptying-chart",
    "No archived emptying dates are available for the last six months."
  );

  renderBreakdown(
    allRecords,
    getSupplierName,
    "supplier-chart",
    "No supplier records available."
  );

  renderBreakdown(
    allRecords,
    record => record.shipping_line || "Unassigned",
    "shipping-chart",
    "No shipping-line records available."
  );

  renderEtaWatchlist(activeRecords);
  renderInsights(allRecords);
  renderRecordSummary(activeRecords, archivedRecords);

  document.getElementById("analytics-message").style.display = "none";

  document.getElementById("analytics-updated").textContent =
    `Last updated: ${new Date().toLocaleString()}`;
}

async function loadAnalytics() {
  const message = document.getElementById("analytics-message");
  const refreshButton = document.getElementById("refresh-analytics");

  message.style.display = "block";
  message.classList.remove("error");
  message.textContent = "Loading shipment analytics...";

  refreshButton.disabled = true;
  refreshButton.textContent = "Loading...";

  try {
    const [activeResult, archivedResult] = await Promise.all([
      analyticsDB
        .from("containers")
        .select("*, suppliers(name)"),

      analyticsDB
        .from("archived_containers")
        .select("*, suppliers(name)")
        .order("emptied_on", { ascending: false })
    ]);

    if (activeResult.error) {
      throw new Error(
        `Could not load active containers: ${activeResult.error.message}`
      );
    }

    if (archivedResult.error) {
      throw new Error(
        `Could not load archived containers: ${archivedResult.error.message}`
      );
    }

    activeRecords = activeResult.data || [];
    archivedRecords = archivedResult.data || [];

    renderAnalytics();

  } catch (error) {
    console.error("CargoVis Analytics error:", error);

    message.classList.add("error");
    message.style.display = "block";
    message.textContent = error.message ||
      "Something went wrong while loading analytics.";

  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "↻ Refresh Data";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await Auth.restoreSession();
    Auth.applyRoleVisibility();

    document
      .getElementById("refresh-analytics")
      .addEventListener("click", loadAnalytics);

    await loadAnalytics();

  } catch (error) {
    console.error("CargoVis authentication error:", error);

    const message = document.getElementById("analytics-message");
    message.classList.add("error");
    message.textContent = "Your session could not be verified. Please log in again.";
  }
});
