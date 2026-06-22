// ============================================
// export.js — Excel & PDF export
// Uses the same libraries and navy styling as the Excel/PDF files
// we built together earlier in this project.
// ============================================

async function exportExcel() {
  const isArchive = window.location.pathname.includes("archive.html");
  const rows = isArchive
    ? await Containers.fetchArchivedContainers()
    : await Containers.fetchActiveContainers();

  const exportRows = rows.map((r) => {
    const base = {
      "Supplier": r.suppliers ? r.suppliers.name : "",
      "Container No.": r.container_number,
      "Vessel": r.vessel || "—",
      "ETA": Containers.formatFullDate(r.eta),
      "Shipping Line": r.shipping_line || "—",
      "Recipient": r.recipient || "WAGYINGO",
    };
    if (isArchive) {
      base["Emptied On"] = Containers.formatFullDate(r.emptied_on);
    } else {
      base["Status"] = r.status;
    }
    return base;
  });

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isArchive ? "Archive" : "Active");
  const filename = `containers_${isArchive ? "archive" : "active"}_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

async function exportPDF() {
  const isArchive = window.location.pathname.includes("archive.html");
  const rows = isArchive
    ? await Containers.fetchArchivedContainers()
    : await Containers.fetchActiveContainers();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.setTextColor(31, 56, 100);
  doc.text(`Container Tracker — ${isArchive ? "Archive" : "Active"}`, 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Exported: ${new Date().toLocaleDateString()}`, 14, 20);

  const head = isArchive
    ? [["Supplier", "Container No.", "Vessel", "ETA", "Shipping Line", "Recipient", "Emptied On"]]
    : [["Supplier", "Container No.", "Vessel", "ETA", "Shipping Line", "Status", "Recipient"]];

  const body = rows.map((r) => {
    const supplierName = r.suppliers ? r.suppliers.name : "";
    return isArchive
      ? [supplierName, r.container_number, r.vessel || "—", Containers.formatFullDate(r.eta), r.shipping_line || "—", r.recipient || "WAGYINGO", Containers.formatFullDate(r.emptied_on)]
      : [supplierName, r.container_number, r.vessel || "—", Containers.formatFullDate(r.eta), r.shipping_line || "—", r.status, r.recipient || "WAGYINGO"];
  });

  doc.autoTable({
    head, body, startY: 25,
    headStyles: { fillColor: [31, 56, 100], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [220, 230, 241] },
    didParseCell(data) {
      if (!isArchive && data.section === "body" && data.column.index === 5) {
        if (data.cell.raw === "ARRIVED") data.cell.styles.textColor = [39, 98, 33];
        else data.cell.styles.textColor = [156, 0, 6];
      }
    },
  });

  const filename = `containers_${isArchive ? "archive" : "active"}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}

window.exportExcel = exportExcel;
window.exportPDF = exportPDF;
