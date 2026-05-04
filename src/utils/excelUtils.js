import * as XLSX from 'xlsx';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';

// Export array of objects to Excel file
export function exportToExcel(rows, filename, sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(rows);
  // Set RTL for Arabic
  if (!ws['!props']) ws['!props'] = {};
  ws['!props'].RTL = true;

  // Auto column widths
  const cols = Object.keys(rows[0] || {}).map(k => ({
    wch: Math.max(12, k.length + 4)
  }));
  ws['!cols'] = cols;

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// Read Excel file from input event → returns array of objects
export function importFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Export multi-sheet workbook with optional data validations.
// validations = [{ sheetIndex, sqref, listFormula }]  e.g. listFormula: "'قائمة المخزون'!$A$2:$A$500"
export function exportMultiSheetWithValidation(sheets, filename, validations = []) {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    if (!ws['!props']) ws['!props'] = {};
    ws['!props'].RTL = true;
    if (rows.length) {
      ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(14, k.length + 4) }));
    }
    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  // Write to buffer (xlsx is a zip file)
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

  if (validations.length === 0) {
    triggerDownload(buf, filename);
    return;
  }

  // Group validations by sheet index
  const bySheet = {};
  validations.forEach(v => {
    if (!bySheet[v.sheetIndex]) bySheet[v.sheetIndex] = [];
    bySheet[v.sheetIndex].push(v);
  });

  // Unzip → patch sheet XML → rezip
  try {
    const files = unzipSync(new Uint8Array(buf));
    Object.entries(bySheet).forEach(([idx, vals]) => {
      const sheetPath = `xl/worksheets/sheet${Number(idx) + 1}.xml`;
      if (!files[sheetPath]) return;
      let xml = strFromU8(files[sheetPath]);
      const dvXml = `<dataValidations count="${vals.length}">${
        vals.map(v => (
          `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="${v.sqref}">` +
          `<formula1>${v.listFormula}</formula1>` +
          `</dataValidation>`
        )).join('')
      }</dataValidations>`;
      // Insert before </worksheet> (dataValidations must come after sheetData but before pageMargins)
      // Safe insertion: insert after </sheetData>
      if (xml.includes('</sheetData>')) {
        xml = xml.replace('</sheetData>', '</sheetData>' + dvXml);
      } else {
        xml = xml.replace('</worksheet>', dvXml + '</worksheet>');
      }
      files[sheetPath] = strToU8(xml);
    });
    const out = zipSync(files);
    triggerDownload(out.buffer, filename);
  } catch (err) {
    console.error('Failed to inject validations:', err);
    triggerDownload(buf, filename); // fallback without validation
  }
}

function triggerDownload(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

// Export multi-sheet workbook: sheets = [{ name, rows }]
export function exportMultiSheet(sheets, filename) {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    if (!ws['!props']) ws['!props'] = {};
    ws['!props'].RTL = true;
    if (rows.length) {
      ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(14, k.length + 4) }));
    }
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, filename);
}

// Generate downloadable sample (template) Excel file
export function downloadSampleFile(headers, sampleRow, filename) {
  const rows = [sampleRow, ...Array(4).fill({}).map(() =>
    headers.reduce((acc, h) => ({ ...acc, [h]: '' }), {})
  )];
  exportToExcel(rows, filename, 'Template');
}

// Print element via window.print() with custom styles
export function printArea(elementId, title = 'تقرير') {
  const el = document.getElementById(elementId);
  if (!el) return;
  const win = window.open('', '_blank', 'width=1024,height=768');
  win.document.write(`
    <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', sans-serif; }
      body { padding: 20px; color: #1e293b; }
      h1, h2, h3 { margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.85rem; }
      th, td { padding: 10px 12px; border: 1px solid #e2e8f0; text-align: right; }
      th { background: #0d9488; color: white; font-weight: 700; }
      tr:nth-child(even) td { background: #f8fafc; }
      .print-header { border-bottom: 3px solid #0d9488; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
      .print-header h1 { color: #0d9488; font-size: 1.5rem; }
      .print-meta { color: #64748b; font-size: 0.85rem; }
      .badge { background: #f0fdfa; color: #0d9488; padding: 2px 8px; border-radius: 4px; font-size: 0.78rem; }
      @media print { body { padding: 0; } button { display: none !important; } }
    </style>
    </head><body>
      <div class="print-header">
        <div><h1>${title}</h1><div class="print-meta">Diet Plan System</div></div>
        <div class="print-meta">📅 ${new Date().toLocaleDateString('ar-KW', { dateStyle: 'long' })}</div>
      </div>
      ${el.innerHTML}
    </body></html>
  `);
  win.document.close();
  setTimeout(() => { win.print(); }, 500);
}

// Export as PDF (uses browser print → Save as PDF — works for Arabic out of the box)
export function exportToPDF(elementId, title = 'تقرير') {
  const el = document.getElementById(elementId);
  if (!el) return;
  const win = window.open('', '_blank', 'width=1024,height=768');
  win.document.write(`
    <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
    <style>
      @page { size: A4; margin: 12mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', sans-serif; }
      body { color: #1e293b; }
      .pdf-tip { background:#fef3c7; border:1px solid #f59e0b; padding:10px 14px; border-radius:6px; margin-bottom:14px; font-size:.85rem; color:#92400e; }
      h1, h2, h3 { margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.82rem; page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      th, td { padding: 8px 10px; border: 1px solid #e2e8f0; text-align: right; }
      th { background: #0d9488; color: white; font-weight: 700; }
      tr:nth-child(even) td { background: #f8fafc; }
      .print-header { border-bottom: 3px solid #0d9488; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
      .print-header h1 { color: #0d9488; font-size: 1.4rem; }
      .print-meta { color: #64748b; font-size: 0.85rem; }
      .badge { background: #f0fdfa; color: #0d9488; padding: 2px 8px; border-radius: 4px; font-size: 0.78rem; }
      .stats-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:14px; }
      .stat-card { border:1px solid #e2e8f0; padding:10px; border-radius:6px; background:#fff; }
      .stat-label { color:#64748b; font-size:.78rem; }
      .stat-value { font-size:1.2rem; font-weight:700; margin-top:4px; }
      button { display:none !important; }
      @media print { .pdf-tip { display:none; } body { padding: 0; } }
    </style>
    </head><body>
      <div class="pdf-tip">💡 لحفظ كـ PDF: اختر <strong>"Save as PDF"</strong> أو <strong>"Microsoft Print to PDF"</strong> من قائمة الطابعة</div>
      <div class="print-header">
        <div><h1>${title}</h1><div class="print-meta">Diet Plan System</div></div>
        <div class="print-meta">📅 ${new Date().toLocaleDateString('ar-KW', { dateStyle: 'long' })}</div>
      </div>
      ${el.innerHTML}
    </body></html>
  `);
  win.document.close();
  setTimeout(() => { win.print(); }, 600);
}

// Buttons component-ready styles
export const TOOL_BTN_STYLE = {
  base: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'white', cursor: 'pointer', fontFamily: 'var(--font-main)',
    fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)',
    transition: 'all 0.15s',
  },
};
