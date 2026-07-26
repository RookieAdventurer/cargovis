// export.js — Excel & PDF export

async function exportExcel() {
  const isArch = window.location.pathname.includes("archive");
  const rows = isArch ? await Containers.fetchArchivedContainers() : await Containers.fetchActiveContainers();
  const out = rows.map(r => {
    const base = {
      "Supplier": r.suppliers?.name||"",
      "Container No.": r.container_number,
      "Vessel": r.vessel||"—",
      "ETA": Containers.formatFullDate(r.eta),
      "Shipping Line": r.shipping_line||"—",
      "Recipient": r.recipient||"WAGYINGO",
    };
    if (isArch) base["Emptied On"] = Containers.formatFullDate(r.emptied_on);
    else base["Status"] = r.status;
    return base;
  });
  const ws = XLSX.utils.json_to_sheet(out);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isArch?"Archive":"Active");
  XLSX.writeFile(wb, `containers_${isArch?"archive":"active"}_${new Date().toISOString().split("T")[0]}.xlsx`);
}

async function exportPDF() {
  const isArch = window.location.pathname.includes("archive");
  const rows = isArch ? await Containers.fetchArchivedContainers() : await Containers.fetchActiveContainers();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:"landscape" });
  doc.setFontSize(14); doc.setTextColor(31,56,100);
  doc.text(`Container Tracker — ${isArch?"Archive":"Active"}`, 14, 14);
  doc.setFontSize(9); doc.setTextColor(100);
  doc.text(`Exported: ${new Date().toLocaleDateString()}`, 14, 20);
  const head = isArch
    ? [["Supplier","Container No.","Vessel","ETA","Shipping Line","Recipient","Emptied On"]]
    : [["Supplier","Container No.","Vessel","ETA","Shipping Line","Status","Recipient"]];
  const body = rows.map(r => {
    const s = r.suppliers?.name||"";
    return isArch
      ? [s,r.container_number,r.vessel||"—",Containers.formatFullDate(r.eta),r.shipping_line||"—",r.recipient||"WAGYINGO",Containers.formatFullDate(r.emptied_on)]
      : [s,r.container_number,r.vessel||"—",Containers.formatFullDate(r.eta),r.shipping_line||"—",r.status,r.recipient||"WAGYINGO"];
  });
  doc.autoTable({ head, body, startY:25,
    headStyles:{ fillColor:[31,56,100], fontSize:8 },
    bodyStyles:{ fontSize:7 },
    alternateRowStyles:{ fillColor:[220,230,241] },
  });
  doc.save(`containers_${isArch?"archive":"active"}_${new Date().toISOString().split("T")[0]}.pdf`);
}

window.exportExcel = exportExcel;
window.exportPDF   = exportPDF;
