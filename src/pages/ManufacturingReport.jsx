import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { MEALS_DATA } from '../firebase/mealService';
import { getClients } from '../firebase/clientService';
import { getAllSubscriptions, getSubscriptionStatus } from '../firebase/subscriptionService';
import { useLang } from '../LanguageContext';

// ─────────────────────────────────────────────
// ثوابت
// ─────────────────────────────────────────────
const GRAM_SIZES = [80, 90, 100, 120, 150, 180, 200];

// أقسام الوجبات — الترتيب: فطار → غداء → عشاء → سناك
const MEAL_SECTIONS = [
  { key: 'افطار', labelAr: 'الفطور',  labelEn: 'Breakfast', color: '#0d9488' },
  { key: 'غداء',  labelAr: 'الغداء',  labelEn: 'Lunch',      color: '#7c3aed' },
  { key: 'عشاء',  labelAr: 'العشاء',  labelEn: 'Dinner',     color: '#2563eb' },
  { key: 'سناك',  labelAr: 'السناك',  labelEn: 'Snacks',     color: '#d97706' },
];

// تحويل protein → أقرب gram size
const proteinToGram = (protein) => {
  const p = Number(protein) || 100;
  // أبسط mapping: نختار أقرب قيمة من GRAM_SIZES
  return GRAM_SIZES.reduce((prev, curr) =>
    Math.abs(curr - p) < Math.abs(prev - p) ? curr : prev
  );
};

// ─────────────────────────────────────────────
// ManufacturingReport
// ─────────────────────────────────────────────
export default function ManufacturingReport() {
  const { lang, isAr } = useLang();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData]     = useState(null);
  const [loading, setLoading]           = useState(false);
  const [fetched, setFetched]           = useState(false);

  // ── labels ثنائية اللغة ──
  const L = {
    title:        isAr ? 'تقرير التصنيع'         : 'Manufacturing Report',
    subtitle:     isAr ? 'تجميع الطلبات اليومية حسب الجرامات' : 'Daily orders aggregated by gram size',
    dateLabel:    isAr ? 'تاريخ التصنيع'         : 'Manufacturing Date',
    generate:     isAr ? '📊 إنشاء التقرير'      : '📊 Generate Report',
    generating:   isAr ? 'جاري الحساب...'        : 'Calculating...',
    print:        isAr ? '🖨️ طباعة'              : '🖨️ Print',
    exportPdf:    isAr ? '📄 تصدير PDF'          : '📄 Export PDF',
    clients:      isAr ? 'عميل لديهم اختيارات'  : 'clients with selections',
    totalMeals:   isAr ? 'وجبة إجمالي'           : 'total meals',
    mealGr:       isAr ? 'الوجبة / الجرام'       : 'MEAL / GR',
    total:        'TOTAL',
    totalInGrams: 'TOTAL IN GRAMS',
    subtotal:     isAr ? 'مجموع'                 : 'Subtotal',
    noData:       isAr ? 'اختر التاريخ وأنشئ التقرير' : 'Select a date and generate the report',
    noDataSub:    isAr ? 'سيتم تجميع اختيارات العملاء وترتيبها حسب الجرامات' : 'Client meal selections will be aggregated by gram size',
  };

  // ── بناء التقرير ──
  const buildReport = async () => {
    setLoading(true);
    setFetched(false);

    // 1. جلب كل البيانات بالتوازي
    const [clientsList, allSubs, snapshot] = await Promise.all([
      getClients(),
      getAllSubscriptions(),
      getDocs(collection(db, 'clientDailyMeals')),
    ]);

    // 2. فلترة اختيارات اليوم المحدد
    const dayDocs = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.date === selectedDate);

    // 3. map: clientId → gram size — فقط العملاء اللي عندهم اشتراك نشط
    const clientGramMap = {};
    const activeClientIds = new Set();
    for (const client of clientsList) {
      const activeSub = allSubs.find(
        s => s.clientId === client.id && getSubscriptionStatus(s) === 'active'
      );
      if (!activeSub) continue; // تجاهل بدون اشتراك نشط
      activeClientIds.add(client.id);
      const protein  = activeSub?.protein || client.protein || 100;
      clientGramMap[client.id] = proteinToGram(protein);
    }

    // 4. تجميع الوجبات — فقط للعملاء النشطين
    const mealAgg = {};

    for (const dayDoc of dayDocs) {
      if (!activeClientIds.has(dayDoc.clientId)) continue; // تجاهل غير النشطين
      const gramSize = clientGramMap[dayDoc.clientId] || 100;

      for (const section of MEAL_SECTIONS) {
        const mealList = dayDoc.meals?.[section.key] || [];
        for (const entry of mealList) {
          const master   = MEALS_DATA.find(m => m.id === entry.id);
          const titleAr  = master?.mealTitle  || entry.title || entry.id;
          const titleEn  = master?.mealTitleEn || titleAr;

          if (!mealAgg[entry.id]) {
            mealAgg[entry.id] = {
              id: entry.id, titleAr, titleEn,
              sectionKey: section.key,
              grams: Object.fromEntries(GRAM_SIZES.map(g => [g, 0])),
              total: 0,
            };
          }
          mealAgg[entry.id].grams[gramSize] = (mealAgg[entry.id].grams[gramSize] || 0) + 1;
          mealAgg[entry.id].total += 1;
        }
      }
    }

    // 5. توزيع على الأقسام
    const bySection = {};
    for (const sec of MEAL_SECTIONS) {
      bySection[sec.key] = Object.values(mealAgg).filter(m => m.sectionKey === sec.key);
    }

    // 6. إجماليات Grand Total
    const totalsRow = Object.fromEntries(GRAM_SIZES.map(g => [g, 0]));
    let grandTotal  = 0;
    for (const m of Object.values(mealAgg)) {
      for (const g of GRAM_SIZES) totalsRow[g] += m.grams[g] || 0;
      grandTotal += m.total;
    }

    setReportData({ date: selectedDate, bySection, totalsRow, grandTotal, clientsCount: dayDocs.length });
    setFetched(true);
    setLoading(false);
  };

  // ── format date ──
  const fmtDate = (d) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  return (
    <div>
      {/* ─── Page Header ─── */}
      <div className="page-header no-print">
        <div>
          <h2>🏭 {L.title}</h2>
          <div className="breadcrumb">{L.subtitle}</div>
        </div>
        {fetched && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline" onClick={() => window.print()}>{L.print}</button>
            <button className="btn btn-primary" onClick={() => window.print()}>{L.exportPdf}</button>
          </div>
        )}
      </div>

      {/* ─── Controls ─── */}
      <div className="page-body no-print">
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-body">
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1, maxWidth: '300px' }}>
                <label className="form-label">📅 {L.dateLabel}</label>
                <input type="date" className="form-control" value={selectedDate}
                  onChange={e => { setSelectedDate(e.target.value); setFetched(false); }} />
              </div>
              <button className="btn btn-primary" onClick={buildReport}
                disabled={loading} style={{ padding: '10px 32px' }}>
                {loading
                  ? <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />&nbsp;{L.generating}</>
                  : L.generate}
              </button>
            </div>

            {fetched && reportData && (
              <div style={{
                display: 'flex', gap: '24px', marginTop: '16px',
                padding: '12px 16px', background: '#f0fdfa',
                borderRadius: '8px', flexWrap: 'wrap', fontSize: '0.88rem'
              }}>
                <span style={{ color: '#0f766e', fontWeight: 700 }}>📅 {fmtDate(reportData.date)}</span>
                <span style={{ color: '#0d9488', fontWeight: 700 }}>👥 {reportData.clientsCount} {L.clients}</span>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>🍽️ {reportData.grandTotal} {L.totalMeals}</span>
              </div>
            )}
          </div>
        </div>

        {/* Screen preview */}
        {fetched && reportData && (
          <ReportTable reportData={reportData} lang={lang} isAr={isAr} L={L} />
        )}

        {/* Empty state */}
        {!fetched && !loading && (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">🏭</div>
              <h3>{L.noData}</h3>
              <p>{L.noDataSub}</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Print / PDF Area ─── */}
      {fetched && reportData && (
        <div className="print-only" style={{ display: 'none' }}>
          <style>{`
            @media print {
              .print-only { display: block !important; }
              .no-print   { display: none  !important; }
              body {
                background: white !important;
                margin: 0; padding: 0;
                font-family: Cairo, Arial, sans-serif !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              @page { size: A4 portrait; margin: 10mm 14mm; }
              .print-wrap {
                width: 100%;
                box-sizing: border-box;
              }
            }
          `}</style>
          <div className="print-wrap">
            <ReportTable reportData={reportData} lang={lang} isAr={isAr} L={L} isPrint />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ReportTable
// ─────────────────────────────────────────────
function ReportTable({ reportData, lang, isAr, L, isPrint = false }) {
  const { date, bySection, totalsRow, grandTotal } = reportData;

  const fmtDate = (d) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };

  // section totals helper
  const sectionTotals = (key) => {
    const meals = bySection[key] || [];
    const row   = Object.fromEntries(GRAM_SIZES.map(g => [g, 0]));
    let total   = 0;
    meals.forEach(m => { GRAM_SIZES.forEach(g => { row[g] += m.grams[g] || 0; }); total += m.total; });
    return { row, total };
  };

  // styles
  const fs    = isPrint ? '9px'    : '13px';
  const pad   = isPrint ? '3px 4px' : '9px 13px';
  const padNm = isPrint ? '3px 7px' : '9px 16px';

  const thBase = {
    border: '1px solid #cbd5e1', padding: pad,
    textAlign: 'center', fontWeight: 700,
    background: '#f1f5f9', color: '#1e293b',
    whiteSpace: 'nowrap', fontSize: fs,
    fontFamily: "'Cairo', Arial, sans-serif",
  };
  const td = (bold, bg, color) => ({
    border: '1px solid #e2e8f0', padding: pad,
    textAlign: 'center',
    fontWeight: isPrint ? 700 : (bold ? 700 : 400),
    background: bg || 'white',
    color: color || '#1e293b',
    fontSize: fs,
  });
  const tdName = (bg) => ({
    ...td(false, bg),
    textAlign: isAr ? 'right' : 'left',
    padding: padNm,
    color: '#374151',
    fontWeight: isPrint ? 700 : 400,
  });

  return (
    <div className={isPrint ? 'print-wrap' : ''} style={{
      background: 'white',
      borderRadius: isPrint ? 0 : '12px',
      border: isPrint ? 'none' : '1px solid #e2e8f0',
      overflow: isPrint ? 'visible' : 'hidden',
      fontFamily: "'Cairo', Arial, sans-serif",
      direction: isAr ? 'rtl' : 'ltr',
    }}>

      {/* ── Report Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: isPrint ? '10px 16px' : '16px 24px',
        borderBottom: '2px solid #e2e8f0',
        direction: 'ltr',   // header دايمًا LTR زي PDF الأصلي
      }}>
        {/* Logo left */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '2.5px solid #16a34a', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>🌿</div>

        {/* Title + Date */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: isPrint ? '14pt' : '18px', color: '#1e293b' }}>
            Manufacturing Report
          </div>
          <div style={{ fontWeight: 700, fontSize: isPrint ? '20pt' : '28px', color: '#1e293b', marginTop: 4 }}>
            {fmtDate(date)}
          </div>
        </div>

        {/* Logo right */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '2.5px solid #16a34a',
        }} />
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: isPrint ? 'visible' : 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontFamily: "'Cairo', Arial, sans-serif",
          direction: isAr ? 'rtl' : 'ltr',
        }}>
          {/* colgroup يحدد عرض كل عمود بدقة */}
          <colgroup>
            {/* اسم الوجبة - 35% */}
            <col style={{ width: isPrint ? '35%' : '30%' }} />
            {/* أعمدة الجرامات - كل واحدة 6% */}
            {GRAM_SIZES.map(g => <col key={g} style={{ width: isPrint ? '6%' : '7%' }} />)}
            {/* TOTAL */}
            <col style={{ width: isPrint ? '7%' : '8%' }} />
            {/* TOTAL IN GRAMS */}
            <col style={{ width: isPrint ? '9%' : '10%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{
                ...thBase,
                textAlign: isAr ? 'right' : 'left',
                padding: padNm,
                fontSize: isPrint ? '9pt' : thBase.fontSize,
                fontWeight: 700,
              }}>
                {L.mealGr}
              </th>
              {GRAM_SIZES.map(g => (
                <th key={g} style={{
                  ...thBase,
                  fontSize: isPrint ? '9pt' : thBase.fontSize,
                  fontWeight: 700,
                  padding: isPrint ? '4pt 2pt' : thBase.padding,
                }}>
                  {g}
                </th>
              ))}
              <th style={{
                ...thBase,
                background: '#1e293b', color: 'white',
                fontSize: isPrint ? '9pt' : thBase.fontSize,
                fontWeight: 700,
                padding: isPrint ? '4pt 2pt' : thBase.padding,
              }}>
                {L.total}
              </th>
              <th style={{
                ...thBase,
                background: '#1e293b', color: 'white',
                fontSize: isPrint ? '9pt' : thBase.fontSize,
                fontWeight: 700,
                padding: isPrint ? '4pt 2pt' : thBase.padding,
              }}>
                {L.totalInGrams}
              </th>
            </tr>
          </thead>

          <tbody>
            {MEAL_SECTIONS.map(sec => {
              const meals = bySection[sec.key] || [];
              if (meals.length === 0) return null;
              const { row: secRow, total: secTotal } = sectionTotals(sec.key);
              const label = isAr ? sec.labelAr : sec.labelEn;

              return [
                /* Section header */
                <tr key={`h-${sec.key}`}>
                  <td colSpan={GRAM_SIZES.length + 3} style={{
                    background: sec.color, color: 'white', fontWeight: 700,
                    padding: isPrint ? '5px 12px' : '7px 16px',
                    border: `1px solid ${sec.color}`,
                    fontSize: isPrint ? '12px' : '14px',
                    textAlign: isAr ? 'right' : 'left',
                  }}>
                    {label}
                  </td>
                </tr>,

                /* Meal rows */
                ...meals.map((meal, idx) => {
                  const name = isAr ? meal.titleAr : meal.titleEn;
                  const totalGrams = GRAM_SIZES.reduce((s, g) => s + (meal.grams[g] || 0) * g, 0);
                  const rowBg = idx % 2 === 0 ? 'white' : '#f8fafc';
                  const printCell = isPrint ? { fontSize: '9pt', padding: '3pt 2pt', fontWeight: 700 } : {};
                  const printNameCell = isPrint ? { fontSize: '9pt', padding: '3pt 5pt', fontWeight: 700, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.3' } : {};
                  return (
                    <tr key={meal.id} style={{ background: rowBg }}>
                      <td style={{ ...tdName(rowBg), ...printNameCell }}>{name}</td>
                      {GRAM_SIZES.map(g => (
                        <td key={g} style={{ ...td(false, meal.grams[g] > 0 ? '#f0fdfa' : rowBg), ...printCell }}>
                          {meal.grams[g] > 0 ? meal.grams[g] : 0}
                        </td>
                      ))}
                      <td style={{ ...td(true, '#f0fdfa'), ...printCell }}>{meal.total}</td>
                      <td style={{ ...td(false, '#f8fafc'), ...printCell }}>{totalGrams}</td>
                    </tr>
                  );
                }),

                /* Spacer rows (زي PDF الأصلي) */
                <tr key={`sp1-${sec.key}`}><td colSpan={GRAM_SIZES.length + 3} style={{ padding: '3px', border: 'none', background: 'white' }} /></tr>,
                <tr key={`sp2-${sec.key}`}><td colSpan={GRAM_SIZES.length + 3} style={{ padding: '3px', border: 'none', background: 'white' }} /></tr>,
                <tr key={`sp3-${sec.key}`}><td colSpan={GRAM_SIZES.length + 3} style={{ padding: '3px', border: 'none', background: 'white' }} /></tr>,
              ];
            })}

            {/* ── Grand Total ── */}
            <tr>
              <td style={{
                ...td(true), background: '#0f172a', color: 'white',
                textAlign: isAr ? 'right' : 'left', padding: padNm,
                ...(isPrint ? { fontSize: '10pt', padding: '4pt 5pt', fontWeight: 900 } : {}),
              }}>
                {L.total}
              </td>
              {GRAM_SIZES.map(g => (
                <td key={g} style={{
                  ...td(true), background: '#0f172a',
                  color: totalsRow[g] > 0 ? '#14b8a6' : '#475569',
                  ...(isPrint ? { fontSize: '10pt', padding: '4pt 2pt', fontWeight: 900 } : {}),
                }}>
                  {totalsRow[g] > 0 ? <strong>{totalsRow[g]}</strong> : 0}
                </td>
              ))}
              <td style={{
                ...td(true), background: '#0d9488', color: 'white',
                ...(isPrint ? { fontSize: '10pt', padding: '4pt 2pt', fontWeight: 900 } : {}),
              }}>
                {grandTotal}
              </td>
              <td style={{
                ...td(true), background: '#0d9488', color: 'white',
                ...(isPrint ? { fontSize: '10pt', padding: '4pt 2pt', fontWeight: 900 } : {}),
              }}>
                {GRAM_SIZES.reduce((s, g) => s + totalsRow[g] * g, 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 24px', borderTop: '1px solid #e2e8f0',
        display: 'flex', justifyContent: 'space-between',
        fontSize: '11px', color: '#94a3b8', background: '#f8fafc',
        direction: 'ltr',
      }}>
        <span>Diet Plan Management System</span>
        <span>Generated: {new Date().toLocaleString(isAr ? 'ar-KW' : 'en-GB')}</span>
        <span>Date: {fmtDate(date)}</span>
      </div>
    </div>
  );
}
