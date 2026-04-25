import * as XLSX from 'xlsx';

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
