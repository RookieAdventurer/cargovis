// ============================================================
//  export.js — Excel & PDF Export
//  Import and call from dashboard.js and archive.js
// ============================================================

import { formatDateFull, getStatus, todayFull } from './app.js';

const SUPPLIERS_ORDER = ['POLAND', 'HOSANNA', 'TEX', 'OFTEX'];

// ── EXCEL ─────────────────────────────────────────────────────
export function exportContainersExcel(containers, filename = 'containers') {
  if (!window.XLSX) { console.error('SheetJS not loaded'); return; }

  const wb = window.XLSX.utils.book_new();

  // Group by supplier
  const grouped = groupBySupplier(containers);

  // One sheet per supplier + one combined sheet
  Object.entries(grouped).forEach(([supplier, rows]) => {
    if (!rows.length) return;
    const sheetData = rows.map(r => formatRowForExcel(r));
    const ws = window.XLSX.utils.json_to_sheet(sheetData);
    styleExcelSheet(ws, sheetData.length);
    window.XLSX.utils.book_append_sheet(wb, ws, supplier);
  });

  // Combined "All" sheet
  const allRows = containers.map(r => ({
    ...formatRowForExcel(r),
    Supplier: r.supplier_id,
  }));
  const allWs = window.XLSX.utils.json_to_sheet(allRows);
  window.XLSX.utils.book_append_sheet(wb, allWs, 'All containers');

  window.XLSX.writeFile(wb, `${filename}_${todayISO()}.xlsx`);
}

export function exportArchiveExcel(archive, filename = 'archive') {
  if (!window.XLSX) { console.error('SheetJS not loaded'); return; }

  const rows = archive.map(r => ({
    'Supplier':       r.supplier_id,
    'Container no.':  r.container_no,
    'Vessel':         r.vessel || '—',
    'Original ETA':   formatDateFull(r.eta),
    'Shipping line':  r.line,
    'Recipient':      r.recipient,
    'Emptied on':     formatDateFull(r.emptied_on),
    'Packing list':   r.packing_list?.name || '—',
  }));

  const ws = window.XLSX.utils.json_to_sheet(rows);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Archive');
  window.XLSX.writeFile(wb, `${filename}_${todayISO()}.xlsx`);
}

// ── PDF ───────────────────────────────────────────────────────
export function exportContainersPDF(containers, filename = 'containers') {
  if (!window.jspdf) { console.error('jsPDF not loaded'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });

  // Header
  doc.setFontSize(14);
  doc.setTextColor(31, 56, 100);
  doc.text('Container Tracker — Active containers', 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(`Exported: ${todayFull()}`, 14, 21);

  const grouped = groupBySupplier(containers);
  let startY = 28;

  Object.entries(grouped).forEach(([supplier, rows]) => {
    if (!rows.length) return;

    // Supplier label
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.setFont(undefined, 'bold');
    doc.text(supplier, 14, startY);
    doc.setFont(undefined, 'normal');
    startY += 4;

    doc.autoTable({
      startY,
      head: [['Container no.', 'Vessel', 'ETA', 'Line', 'Status', 'Recipient']],
      body: rows.map(r => [
        r.container_no,
        r.vessel || '—',
        formatDateFull(r.eta),
        r.line,
        getStatus(r.eta) === 'arrived' ? 'Arrived' : 'Not arrived',
        r.recipient,
      ]),
      headStyles:          { fillColor: [31, 56, 100], fontSize: 8, fontStyle: 'bold' },
      bodyStyles:          { fontSize: 7 },
      alternateRowStyles:  { fillColor: [240, 244, 255] },
      margin:              { left: 14, right: 14 },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 4) {
          const isArrived = data.cell.raw === 'Arrived';
          data.cell.styles.textColor  = isArrived ? [6, 95, 70] : [153, 27, 27];
          data.cell.styles.fontStyle  = 'bold';
        }
      },
    });

    startY = doc.lastAutoTable.finalY + 10;

    // Add new page if running out of space
    if (startY > 180) {
      doc.addPage();
      startY = 20;
    }
  });

  doc.save(`${filename}_${todayISO()}.pdf`);
}

export function exportArchivePDF(archive, filename = 'archive') {
  if (!window.jspdf) { console.error('jsPDF not loaded'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(14);
  doc.setTextColor(31, 56, 100);
  doc.text('Container Tracker — Archive', 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(`Exported: ${todayFull()} · ${archive.length} containers`, 14, 21);

  doc.autoTable({
    startY: 28,
    head: [['Supplier', 'Container no.', 'Vessel', 'Original ETA', 'Line', 'Recipient', 'Emptied on']],
    body: archive.map(r => [
      r.supplier_id,
      r.container_no,
      r.vessel || '—',
      formatDateFull(r.eta),
      r.line,
      r.recipient,
      formatDateFull(r.emptied_on),
    ]),
    headStyles:         { fillColor: [31, 56, 100], fontSize: 8 },
    bodyStyles:         { fontSize: 7 },
    alternateRowStyles: { fillColor: [255, 247, 237] },
    margin:             { left: 14, right: 14 },
  });

  doc.save(`${filename}_${todayISO()}.pdf`);
}

// ── HELPERS ───────────────────────────────────────────────────
function groupBySupplier(containers) {
  const grouped = {};
  SUPPLIERS_ORDER.forEach(s => { grouped[s] = []; });
  containers.forEach(r => {
    const key = r.supplier_id || 'OTHER';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });
  return grouped;
}

function formatRowForExcel(r) {
  return {
    'Container no.': r.container_no,
    'Vessel':        r.vessel || '—',
    'ETA':           formatDateFull(r.eta),
    'Shipping line': r.line,
    'Status':        getStatus(r.eta) === 'arrived' ? 'Arrived' : 'Not arrived',
    'Recipient':     r.recipient,
    'Packing list':  r.packing_list?.name || '—',
  };
}

function styleExcelSheet(ws, rowCount) {
  // Set column widths
  ws['!cols'] = [
    { wch: 18 }, // Container no.
    { wch: 24 }, // Vessel
    { wch: 30 }, // ETA
    { wch: 14 }, // Line
    { wch: 14 }, // Status
    { wch: 14 }, // Recipient
    { wch: 24 }, // Packing list
  ];
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}
