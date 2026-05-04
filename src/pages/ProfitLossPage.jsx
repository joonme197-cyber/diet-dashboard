import { useState, useEffect, useRef } from 'react';
import {
  getProfitLoss, saveProfitLoss, getAllProfitLoss, deleteProfitLoss,
  bulkImportProfitLoss, computeStatement,
  SELLING_CATEGORIES, ADMIN_CATEGORIES,
} from '../firebase/profitLossService';
import { getFinanceSummary } from '../firebase/financeService';
import { getInventory, calcInventoryValue } from '../firebase/inventoryService';
import { getExpenses } from '../firebase/expenseService';
import {
  exportToExcel, importFromExcel, downloadSampleFile, printArea, exportToPDF,
} from '../utils/excelUtils';
import { useLang } from '../LanguageContext';

const EMPTY = {
  subscriptionRevenue: 0, otherRevenue: 0,
  openingStock: 0, purchases: 0, directCosts: 0, closingStock: 0,
  sellingExpenses: 0, adminExpenses: 0,
  depreciation: 0, interest: 0, taxes: 0,
  notes: '',
};

const fmt = (n, dec = 3) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const pct = (n) => `${Number(n || 0).toFixed(2)}%`;

// Inline-editable input
const Input = ({ value, onChange, readOnly, hint }) => (
  <td style={{ minWidth: 120 }}>
    <input type="number" step="0.001" value={value}
      onChange={e => onChange(Number(e.target.value) || 0)}
      readOnly={readOnly}
      style={{
        width: '100%', padding: '4px 8px',
        border: readOnly ? '1px solid transparent' : '1px solid #e2e8f0',
        background: readOnly ? '#f8fafc' : 'white',
        borderRadius: 4, fontFamily: 'inherit',
        textAlign: 'left', fontSize: '.85rem',
      }} />
    {hint && <div style={{ fontSize: '.68rem', color: '#94a3b8' }}>{hint}</div>}
  </td>
);

// Statement row
const Row = ({ label, labelEn, value, suffix, bold, total, indent, color, percent, isAr }) => (
  <tr style={{
    background: total ? '#f0fdfa' : 'transparent',
    borderTop: total ? '2px solid #0d9488' : 'none',
    borderBottom: total ? '2px solid #0d9488' : '1px solid #f1f5f9',
  }}>
    <td style={{
      paddingRight: indent ? indent * 20 : 0,
      fontWeight: bold || total ? 700 : 400,
      color: color || (total ? '#0d9488' : '#1e293b'),
      fontSize: total ? '.95rem' : '.85rem',
    }}>
      {isAr ? label : (labelEn || label)}
    </td>
    <td style={{
      textAlign: 'left', fontWeight: bold || total ? 700 : 400,
      color: color || (total ? '#0d9488' : '#1e293b'),
      fontSize: total ? '1rem' : '.85rem',
    }}>
      {fmt(value)} {suffix || (isAr ? 'د.ك' : 'KWD')}
    </td>
    <td style={{
      textAlign: 'left', fontSize: '.75rem', color: '#64748b',
      fontWeight: bold || total ? 600 : 400,
    }}>
      {percent !== undefined ? pct(percent) : ''}
    </td>
  </tr>
);

export default function ProfitLossPage() {
  const { t, isAr } = useLang();
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(EMPTY);
  const [prevData, setPrevData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState([]);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const [saved, summary, inv, expenses, all] = await Promise.all([
      getProfitLoss(monthYear),
      getFinanceSummary(monthYear),
      getInventory(),
      getExpenses(monthYear),
      getAllProfitLoss(),
    ]);

    const closingStock = calcInventoryValue(inv);

    const sellingExp = expenses
      .filter(e => SELLING_CATEGORIES.includes(e.category))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const adminExp = expenses
      .filter(e => ADMIN_CATEGORIES.includes(e.category))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    if (saved) {
      setData({ ...EMPTY, ...saved });
    } else {
      const prevDate = new Date(monthYear + '-01');
      prevDate.setMonth(prevDate.getMonth() - 1);
      const prev = all.find(a => a.monthYear === prevDate.toISOString().slice(0, 7));
      const openingStock = prev?.closingStock !== undefined ? prev.closingStock : closingStock;
      setData({
        ...EMPTY,
        subscriptionRevenue: summary.revenue || 0,
        purchases: summary.purchaseTotal || 0,
        openingStock,
        closingStock,
        sellingExpenses: sellingExp,
        adminExpenses: adminExp,
      });
    }

    const prevDate = new Date(monthYear + '-01');
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMY = prevDate.toISOString().slice(0, 7);
    const prevSaved = all.find(a => a.monthYear === prevMY);
    setPrevData(prevSaved ? computeStatement(prevSaved) : null);

    setHistory(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, [monthYear]);

  const refreshAuto = async () => {
    const [summary, inv, expenses, all] = await Promise.all([
      getFinanceSummary(monthYear),
      getInventory(),
      getExpenses(monthYear),
      getAllProfitLoss(),
    ]);
    const prevDate = new Date(monthYear + '-01');
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prev = all.find(a => a.monthYear === prevDate.toISOString().slice(0, 7));
    const sellingExp = expenses.filter(e => SELLING_CATEGORIES.includes(e.category))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const adminExp = expenses.filter(e => ADMIN_CATEGORIES.includes(e.category))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const closingStock = calcInventoryValue(inv);
    setData(p => ({
      ...p,
      subscriptionRevenue: summary.revenue || 0,
      purchases: summary.purchaseTotal || 0,
      openingStock: prev?.closingStock !== undefined ? prev.closingStock : closingStock,
      closingStock,
      sellingExpenses: sellingExp,
      adminExpenses: adminExp,
    }));
    setMsg(isAr ? '✅ تم تحديث البيانات التلقائية' : '✅ Auto data refreshed');
    setTimeout(() => setMsg(''), 2000);
  };

  const stmt = computeStatement(data);

  const warnings = [];
  if (stmt.cogs < 0) {
    warnings.push(isAr
      ? '⚠️ COGS سالبة — مخزون آخر الفترة أكبر من (الافتتاحى + المشتريات + التكاليف). راجع Opening Stock.'
      : '⚠️ Negative COGS — closing stock exceeds opening + purchases + direct costs. Review Opening Stock.');
  }
  if (stmt.totalRevenue > 0 && Math.abs(stmt.grossProfitMargin) > 95) {
    warnings.push(isAr
      ? `⚠️ هامش الربح الإجمالى ${stmt.grossProfitMargin.toFixed(1)}% غير منطقى. الطبيعى 50–70%. راجع المدخلات.`
      : `⚠️ Gross margin ${stmt.grossProfitMargin.toFixed(1)}% is unusual. Expected range: 50–70%. Review inputs.`);
  }
  if (stmt.totalRevenue === 0 && stmt.cogs > 0) {
    warnings.push(isAr
      ? 'ℹ️ مفيش إيرادات لكن فيه تكلفة بضاعة — لو الشهر لسه ماخلصش، ده طبيعى.'
      : 'ℹ️ No revenue but COGS exist — normal if the month is not yet closed.');
  }
  if (stmt.openingStock === 0 && history.length === 0) {
    warnings.push(isAr
      ? 'ℹ️ Opening Stock = 0 ومفيش شهور سابقة. لو مش أول شهر، حط القيمة الصحيحة.'
      : 'ℹ️ Opening Stock = 0 with no prior history. If not the first month, enter the correct opening value.');
  }

  const handleSave = async () => {
    setSaving(true);
    await saveProfitLoss(monthYear, { ...data, ...stmt });
    setSaving(false);
    setMsg(isAr ? '✅ تم حفظ القائمة' : '✅ Statement saved');
    setTimeout(() => setMsg(''), 2000);
    setHistory(await getAllProfitLoss());
  };

  const handleDelete = async (id) => {
    if (!window.confirm(isAr ? 'حذف قائمة هذا الشهر؟' : 'Delete this month\'s statement?')) return;
    await deleteProfitLoss(id);
    setHistory(await getAllProfitLoss());
    if (id === monthYear) setData(EMPTY);
  };

  const handleExport = () => {
    const rows = [
      { [t('item')]: isAr ? 'إيرادات الاشتراكات' : 'Subscription Revenue',     [t('amountKWD')]: fmt(stmt.subscriptionRevenue), [t('percent')]: '' },
      { [t('item')]: isAr ? 'إيرادات أخرى' : 'Other Revenue',                  [t('amountKWD')]: fmt(stmt.otherRevenue),         [t('percent')]: '' },
      { [t('item')]: isAr ? 'إجمالي الإيرادات' : 'Total Revenue',              [t('amountKWD')]: fmt(stmt.totalRevenue),         [t('percent')]: '100.00%' },
      { [t('item')]: '', [t('amountKWD')]: '', [t('percent')]: '' },
      { [t('item')]: isAr ? 'مخزون أول الفترة' : 'Opening Stock',              [t('amountKWD')]: fmt(stmt.openingStock),         [t('percent')]: '' },
      { [t('item')]: isAr ? '+ المشتريات' : '+ Purchases',                     [t('amountKWD')]: fmt(stmt.purchases),            [t('percent')]: '' },
      { [t('item')]: isAr ? '+ تكاليف مباشرة' : '+ Direct Costs',             [t('amountKWD')]: fmt(stmt.directCosts),          [t('percent')]: '' },
      { [t('item')]: isAr ? '- مخزون آخر الفترة' : '- Closing Stock',          [t('amountKWD')]: fmt(stmt.closingStock),         [t('percent')]: '' },
      { [t('item')]: isAr ? '= تكلفة البضاعة المباعة (COGS)' : '= COGS',       [t('amountKWD')]: fmt(stmt.cogs),                [t('percent')]: pct(stmt.cogsRatio) },
      { [t('item')]: '', [t('amountKWD')]: '', [t('percent')]: '' },
      { [t('item')]: isAr ? 'مجمل الربح (Gross Profit)' : 'Gross Profit',      [t('amountKWD')]: fmt(stmt.grossProfit),          [t('percent')]: pct(stmt.grossProfitMargin) },
      { [t('item')]: '', [t('amountKWD')]: '', [t('percent')]: '' },
      { [t('item')]: isAr ? '- مصروفات بيع وتسويق' : '- Selling & Distribution', [t('amountKWD')]: fmt(stmt.sellingExpenses),   [t('percent')]: '' },
      { [t('item')]: isAr ? '- مصروفات إدارية' : '- G&A',                      [t('amountKWD')]: fmt(stmt.adminExpenses),        [t('percent')]: '' },
      { [t('item')]: isAr ? '= إجمالي المصروفات التشغيلية' : '= Total Opex',   [t('amountKWD')]: fmt(stmt.totalOpex),            [t('percent')]: pct(stmt.opexRatio) },
      { [t('item')]: '', [t('amountKWD')]: '', [t('percent')]: '' },
      { [t('item')]: 'EBITDA',                                                   [t('amountKWD')]: fmt(stmt.ebitda),               [t('percent')]: pct(stmt.ebitdaMargin) },
      { [t('item')]: isAr ? '- إهلاك' : '- Depreciation',                       [t('amountKWD')]: fmt(stmt.depreciation),         [t('percent')]: '' },
      { [t('item')]: isAr ? 'الربح التشغيلي (EBIT)' : 'Operating Profit (EBIT)',[t('amountKWD')]: fmt(stmt.operatingProfit),     [t('percent')]: pct(stmt.operatingMargin) },
      { [t('item')]: isAr ? '- فوائد' : '- Interest',                            [t('amountKWD')]: fmt(stmt.interest),             [t('percent')]: '' },
      { [t('item')]: isAr ? 'الربح قبل الضريبة (EBT)' : 'EBT',                 [t('amountKWD')]: fmt(stmt.ebt),                  [t('percent')]: '' },
      { [t('item')]: isAr ? '- ضرائب' : '- Taxes',                              [t('amountKWD')]: fmt(stmt.taxes),                [t('percent')]: '' },
      { [t('item')]: isAr ? 'صافي الربح (Net Profit)' : 'Net Profit',           [t('amountKWD')]: fmt(stmt.netProfit),            [t('percent')]: pct(stmt.netMargin) },
    ];
    exportToExcel(rows, `profit_loss_${monthYear}.xlsx`, `${isAr ? 'قائمة الدخل' : 'Income Statement'} ${monthYear}`);
  };

  const handleTemplate = () => {
    downloadSampleFile(
      ['الشهر', 'إيرادات الاشتراكات', 'إيرادات أخرى', 'مخزون أول الفترة', 'المشتريات',
        'تكاليف مباشرة', 'مخزون آخر الفترة', 'مصروفات بيع وتسويق', 'مصروفات إدارية',
        'إهلاك', 'فوائد', 'ضرائب', 'ملاحظات'],
      {
        'الشهر': '2026-01', 'إيرادات الاشتراكات': 45000, 'إيرادات أخرى': 0,
        'مخزون أول الفترة': 5000, 'المشتريات': 12000, 'تكاليف مباشرة': 500,
        'مخزون آخر الفترة': 4500, 'مصروفات بيع وتسويق': 2500, 'مصروفات إدارية': 8000,
        'إهلاك': 1000, 'فوائد': 0, 'ضرائب': 0, 'ملاحظات': 'يناير'
      },
      'profit_loss_template.xlsx'
    );
  };

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const count = await bulkImportProfitLoss(rows);
      setMsg(`✅ ${isAr ? 'تم استيراد' : 'Imported'} ${count} ${isAr ? 'شهر' : 'months'}`);
      setHistory(await getAllProfitLoss());
      load();
    } catch (err) { setMsg((isAr ? 'فشل الاستيراد: ' : 'Import failed: ') + err.message); }
    e.target.value = '';
    setTimeout(() => setMsg(''), 3000);
  };

  if (loading) return <div className="loading"><div className="spinner" />{t('loading')}</div>;

  const variance = (cur, prev) => {
    if (!prev || prev === 0) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  };

  const set = (k) => (v) => setData(p => ({ ...p, [k]: v }));

  const rowProps = { isAr };
  const kwd = isAr ? 'د.ك' : 'KWD';

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>📑 {t('plStatement')}</h2>
          <div className="breadcrumb">
            {isAr ? 'المالية والعمليات / قائمة الدخل' : 'Finance & Ops / Income Statement'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="month" className="form-control" value={monthYear}
            onChange={e => setMonthYear(e.target.value)} style={{ maxWidth: 180 }} />
          <button className="btn btn-ghost" onClick={refreshAuto}>🔄 {t('autoRefresh')}</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>📥 {isAr ? 'استيراد' : 'Import'}</button>
          <button className="btn btn-ghost" onClick={handleExport}>📤 Excel</button>
          <button className="btn btn-ghost" onClick={handleTemplate}>📋 {isAr ? 'قالب' : 'Template'}</button>
          <button className="btn btn-ghost" onClick={() => exportToPDF('pl-print', `${isAr ? 'قائمة الدخل' : 'Income Statement'} ${monthYear}`)}>📄 PDF</button>
          <button className="btn btn-ghost" onClick={() => printArea('pl-print', `${isAr ? 'قائمة الدخل' : 'Income Statement'} ${monthYear}`)}>🖨️ {isAr ? 'طباعة' : 'Print'}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : `💾 ${t('savePL')}`}
          </button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div className="alert alert-info fade-in" style={{ marginBottom: 16 }}>
          💡 <strong>{isAr ? 'قائمة الدخل (P&L Statement):' : 'Income Statement (P&L):'}</strong>{' '}
          {isAr
            ? 'مُعدّة وفق المعايير المحاسبية الدولية مع تطبيق مبدأ المقابلة ومبدأ التحفظ. عدّل الأرقام مباشرة أو استخدم "تحديث تلقائى".'
            : 'Prepared under IFRS with matching & conservatism principles. Edit figures directly or use "Auto Refresh".'}
        </div>

        {warnings.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {warnings.map((w, i) => (
              <div key={i} className="alert fade-in" style={{
                background: w.startsWith('⚠️') ? '#fef3c7' : '#dbeafe',
                borderColor: w.startsWith('⚠️') ? '#f59e0b' : '#3b82f6',
                color: w.startsWith('⚠️') ? '#92400e' : '#1e40af',
                padding: '10px 14px', borderRadius: 8, marginBottom: 8, fontSize: '.85rem',
                border: '1px solid',
              }}>{w}</div>
            ))}
          </div>
        )}

        {/* Top KPIs */}
        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-label">{t('totalRevenue')}</div>
            <div className="stat-value" style={{ color: '#0d9488' }}>{fmt(stmt.totalRevenue)} {kwd}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('grossProfit')} ({pct(stmt.grossProfitMargin)})</div>
            <div className="stat-value" style={{ color: stmt.grossProfit >= 0 ? '#0d9488' : '#dc2626' }}>
              {fmt(stmt.grossProfit)} {kwd}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">EBITDA ({pct(stmt.ebitdaMargin)})</div>
            <div className="stat-value" style={{ color: stmt.ebitda >= 0 ? '#0d9488' : '#dc2626' }}>
              {fmt(stmt.ebitda)} {kwd}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('netProfit')} ({pct(stmt.netMargin)})</div>
            <div className="stat-value" style={{ color: stmt.netProfit >= 0 ? '#0d9488' : '#dc2626', fontSize: '1.6rem' }}>
              {fmt(stmt.netProfit)} {kwd}
            </div>
          </div>
        </div>

        <div id="pl-print">
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ background: '#0d9488', color: 'white' }}>
              <div>
                <h3 style={{ color: 'white' }}>
                  {isAr ? 'قائمة الدخل عن الفترة المنتهية في' : 'Income Statement for the Period Ending'}
                </h3>
                <div style={{ fontSize: '.85rem', opacity: .9 }}>{monthYear} — Diet Plan</div>
              </div>
            </div>
            <div style={{ padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #0d9488' }}>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '.85rem' }}>
                      {t('item')}
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '.85rem', width: 160 }}>
                      {t('amountKWD')}
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '.85rem', width: 90 }}>
                      {t('percent')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* ── REVENUE ── */}
                  <tr><td colSpan={3} style={{ background: '#f0fdfa', padding: '8px 14px', fontWeight: 700, color: '#0d9488', fontSize: '.85rem' }}>
                    1️⃣ {isAr ? 'الإيرادات (Revenue)' : 'Revenue'}
                  </td></tr>
                  <tr>
                    <td style={{ paddingRight: 20, padding: '6px 14px', fontSize: '.85rem' }}>
                      {isAr ? 'إيرادات الاشتراكات' : 'Subscription Revenue'}
                    </td>
                    <Input value={data.subscriptionRevenue} onChange={set('subscriptionRevenue')} />
                    <td style={{ textAlign: 'left', fontSize: '.75rem', color: '#64748b' }}>—</td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: 20, padding: '6px 14px', fontSize: '.85rem' }}>
                      {isAr ? 'إيرادات أخرى' : 'Other Revenue'}
                    </td>
                    <Input value={data.otherRevenue} onChange={set('otherRevenue')} />
                    <td></td>
                  </tr>
                  <Row
                    label="إجمالي الإيرادات (Total Revenue)" labelEn="Total Revenue"
                    value={stmt.totalRevenue} percent={100} total {...rowProps} />

                  {/* ── COGS ── */}
                  <tr><td colSpan={3} style={{ background: '#fef3c7', padding: '8px 14px', fontWeight: 700, color: '#92400e', fontSize: '.85rem' }}>
                    2️⃣ {isAr ? 'تكلفة البضاعة المباعة (COGS) — مبدأ المقابلة' : 'Cost of Goods Sold (COGS) — Matching Principle'}
                  </td></tr>
                  <tr>
                    <td style={{ paddingRight: 20, padding: '6px 14px', fontSize: '.85rem' }}>
                      {isAr ? 'مخزون أول الفترة (Opening Stock)' : 'Opening Stock'}
                    </td>
                    <Input value={data.openingStock} onChange={set('openingStock')}
                      hint={isAr ? 'من إقفال الشهر السابق' : 'From prior month closing'} />
                    <td></td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: 20, padding: '6px 14px', fontSize: '.85rem' }}>
                      (+) {isAr ? 'المشتريات (Purchases)' : 'Purchases'}
                    </td>
                    <Input value={data.purchases} onChange={set('purchases')}
                      hint={isAr ? 'من سجل المشتريات' : 'From purchases ledger'} />
                    <td></td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: 20, padding: '6px 14px', fontSize: '.85rem' }}>
                      (+) {isAr ? 'تكاليف مباشرة (Direct Costs)' : 'Direct Costs'}
                    </td>
                    <Input value={data.directCosts} onChange={set('directCosts')}
                      hint={isAr ? 'نقل/جمارك/تشغيل مباشر' : 'Freight / customs / direct ops'} />
                    <td></td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: 20, padding: '6px 14px', fontSize: '.85rem' }}>
                      (−) {isAr ? 'مخزون آخر الفترة (Closing Stock)' : 'Closing Stock'}
                    </td>
                    <Input value={data.closingStock} onChange={set('closingStock')}
                      hint={isAr ? 'من قيمة المخزون الحالي' : 'From current inventory value'} />
                    <td></td>
                  </tr>
                  <Row
                    label="(=) إجمالي تكلفة البضاعة المباعة" labelEn="(=) Total COGS"
                    value={stmt.cogs} percent={stmt.cogsRatio} bold color="#92400e" {...rowProps} />

                  {/* ── GROSS PROFIT ── */}
                  <Row
                    label="مجمل الربح (Gross Profit) = Revenue − COGS" labelEn="Gross Profit = Revenue − COGS"
                    value={stmt.grossProfit} percent={stmt.grossProfitMargin} total
                    color={stmt.grossProfit >= 0 ? '#0d9488' : '#dc2626'} {...rowProps} />

                  {/* ── OPERATING EXPENSES ── */}
                  <tr><td colSpan={3} style={{ background: '#fee2e2', padding: '8px 14px', fontWeight: 700, color: '#dc2626', fontSize: '.85rem' }}>
                    3️⃣ {isAr ? 'المصروفات التشغيلية (Operating Expenses)' : 'Operating Expenses'}
                  </td></tr>
                  <tr>
                    <td style={{ paddingRight: 20, padding: '6px 14px', fontSize: '.85rem' }}>
                      (−) {isAr ? 'مصروفات بيع وتسويق (Selling & Distribution)' : 'Selling & Distribution'}
                    </td>
                    <Input value={data.sellingExpenses} onChange={set('sellingExpenses')}
                      hint={isAr ? 'إعلانات/توصيل/تغليف' : 'Ads / delivery / packaging'} />
                    <td></td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: 20, padding: '6px 14px', fontSize: '.85rem' }}>
                      (−) {isAr ? 'مصروفات إدارية وعمومية (G&A)' : 'General & Administrative (G&A)'}
                    </td>
                    <Input value={data.adminExpenses} onChange={set('adminExpenses')}
                      hint={isAr ? 'رواتب/إيجار/كهرباء/تأمين' : 'Salaries / rent / utilities / insurance'} />
                    <td></td>
                  </tr>
                  <Row
                    label="(=) إجمالي المصروفات التشغيلية" labelEn="(=) Total Operating Expenses"
                    value={stmt.totalOpex} percent={stmt.opexRatio} bold color="#dc2626" {...rowProps} />

                  {/* ── EBITDA ── */}
                  <Row
                    label="EBITDA — الأرباح قبل الفوائد والضرائب والإهلاك"
                    labelEn="EBITDA — Earnings Before Interest, Taxes, Depreciation & Amortization"
                    value={stmt.ebitda} percent={stmt.ebitdaMargin} total
                    color={stmt.ebitda >= 0 ? '#0d9488' : '#dc2626'} {...rowProps} />

                  {/* ── DEPRECIATION ── */}
                  <tr>
                    <td style={{ paddingRight: 20, padding: '6px 14px', fontSize: '.85rem' }}>
                      (−) {isAr ? 'الإهلاك (Depreciation)' : 'Depreciation'}
                    </td>
                    <Input value={data.depreciation} onChange={set('depreciation')}
                      hint={isAr ? 'إهلاك أصول/معدات' : 'Asset / equipment depreciation'} />
                    <td></td>
                  </tr>

                  {/* ── OPERATING PROFIT ── */}
                  <Row
                    label="الربح التشغيلي (Operating Profit / EBIT)" labelEn="Operating Profit (EBIT)"
                    value={stmt.operatingProfit} percent={stmt.operatingMargin} total
                    color={stmt.operatingProfit >= 0 ? '#0d9488' : '#dc2626'} {...rowProps} />

                  {/* ── INTEREST ── */}
                  <tr>
                    <td style={{ paddingRight: 20, padding: '6px 14px', fontSize: '.85rem' }}>
                      (−) {isAr ? 'فوائد دائنة/مدينة (Interest)' : 'Interest (net)'}
                    </td>
                    <Input value={data.interest} onChange={set('interest')}
                      hint={isAr ? 'فوائد قروض' : 'Loan interest'} />
                    <td></td>
                  </tr>

                  {/* ── EBT ── */}
                  <Row
                    label="الربح قبل الضريبة (EBT)" labelEn="Earnings Before Tax (EBT)"
                    value={stmt.ebt} bold {...rowProps} />

                  {/* ── TAXES ── */}
                  <tr>
                    <td style={{ paddingRight: 20, padding: '6px 14px', fontSize: '.85rem' }}>
                      (−) {isAr ? 'ضرائب (Taxes)' : 'Taxes'}
                    </td>
                    <Input value={data.taxes} onChange={set('taxes')}
                      hint={isAr ? 'الكويت 0% للشركات المحلية' : 'Kuwait: 0% for local companies'} />
                    <td></td>
                  </tr>

                  {/* ── NET PROFIT ── */}
                  <tr style={{ background: stmt.netProfit >= 0 ? '#dcfce7' : '#fee2e2', borderTop: '3px double #0d9488' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, fontSize: '1rem', color: stmt.netProfit >= 0 ? '#15803d' : '#991b1b' }}>
                      {isAr ? 'صافي الربح (Net Profit)' : 'Net Profit'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 800, fontSize: '1.15rem', color: stmt.netProfit >= 0 ? '#15803d' : '#991b1b' }}>
                      {fmt(stmt.netProfit)} {kwd}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: stmt.netProfit >= 0 ? '#15803d' : '#991b1b' }}>
                      {pct(stmt.netMargin)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Variance vs prev period */}
          {prevData && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <h3>📈 {t('varianceAnalysis')}</h3>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead><tr>
                    <th>{t('item')}</th>
                    <th>{t('currentMonth')}</th>
                    <th>{t('prevMonth')}</th>
                    <th>{t('absDiff')}</th>
                    <th>{t('pctDiff')}</th>
                    <th>{t('trend')}</th>
                  </tr></thead>
                  <tbody>
                    {[
                      { labelAr: 'إجمالي الإيرادات', labelEn: 'Total Revenue',        cur: stmt.totalRevenue,     prev: prevData.totalRevenue,     good: 'up' },
                      { labelAr: 'COGS',              labelEn: 'COGS',                  cur: stmt.cogs,             prev: prevData.cogs,             good: 'down' },
                      { labelAr: 'مجمل الربح',        labelEn: 'Gross Profit',          cur: stmt.grossProfit,      prev: prevData.grossProfit,      good: 'up' },
                      { labelAr: 'المصروفات التشغيلية',labelEn: 'Operating Expenses',  cur: stmt.totalOpex,        prev: prevData.totalOpex,        good: 'down' },
                      { labelAr: 'EBITDA',             labelEn: 'EBITDA',               cur: stmt.ebitda,           prev: prevData.ebitda,           good: 'up' },
                      { labelAr: 'صافي الربح',         labelEn: 'Net Profit',           cur: stmt.netProfit,        prev: prevData.netProfit,        good: 'up' },
                    ].map((r, i) => {
                      const diff = r.cur - r.prev;
                      const pctChange = variance(r.cur, r.prev);
                      const isGood = r.good === 'up' ? diff >= 0 : diff <= 0;
                      return (
                        <tr key={i}>
                          <td><strong>{isAr ? r.labelAr : r.labelEn}</strong></td>
                          <td>{fmt(r.cur)}</td>
                          <td>{fmt(r.prev)}</td>
                          <td style={{ color: isGood ? '#0d9488' : '#dc2626' }}>
                            {diff >= 0 ? '+' : ''}{fmt(diff)}
                          </td>
                          <td style={{ color: isGood ? '#0d9488' : '#dc2626' }}>
                            {pctChange === null ? '—' : `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%`}
                          </td>
                          <td>{diff > 0 ? '↗️' : diff < 0 ? '↘️' : '➡️'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* History */}
          <div className="card">
            <div className="card-header">
              <h3>📅 {t('historicalRecord')}</h3>
              <span className="badge badge-teal">{history.length}</span>
            </div>
            <div className="table-wrapper">
              {history.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📑</div>
                  <h3>{isAr ? 'لا يوجد سجل' : 'No records yet'}</h3>
                </div>
              ) : (
                <table>
                  <thead><tr>
                    <th>{t('month')}</th>
                    <th>{isAr ? 'الإيراد' : 'Revenue'}</th>
                    <th>COGS</th>
                    <th>{isAr ? 'مجمل الربح' : 'Gross Profit'}</th>
                    <th>EBITDA</th>
                    <th>{isAr ? 'صافي الربح' : 'Net Profit'}</th>
                    <th>{isAr ? 'هامش' : 'Margin'}</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {history.map(h => {
                      const s = computeStatement(h);
                      return (
                        <tr key={h.id}>
                          <td><strong>{h.monthYear}</strong></td>
                          <td>{fmt(s.totalRevenue)}</td>
                          <td>{fmt(s.cogs)}</td>
                          <td style={{ color: s.grossProfit >= 0 ? '#0d9488' : '#dc2626' }}>{fmt(s.grossProfit)}</td>
                          <td style={{ color: s.ebitda >= 0 ? '#0d9488' : '#dc2626' }}>{fmt(s.ebitda)}</td>
                          <td style={{ color: s.netProfit >= 0 ? '#0d9488' : '#dc2626', fontWeight: 700 }}>{fmt(s.netProfit)}</td>
                          <td>
                            <span className="badge" style={{
                              background: s.netMargin >= 15 ? '#dcfce7' : s.netMargin >= 5 ? '#fef3c7' : '#fee2e2',
                              color: s.netMargin >= 15 ? '#15803d' : s.netMargin >= 5 ? '#92400e' : '#991b1b',
                            }}>{pct(s.netMargin)}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-outline btn-sm" onClick={() => setMonthYear(h.monthYear)}>
                                {t('open')}
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(h.id)}>
                                {t('delete')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
