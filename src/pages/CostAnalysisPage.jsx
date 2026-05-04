import { useState, useEffect, useRef } from 'react';
import {
  getCostAnalysis, saveCostAnalysis, getAllCostAnalyses, deleteCostAnalysis,
  bulkImportCostAnalysis,
  calcCOGS, calcFoodCostPct, calcSellingPrice, calcGrossProfit,
  calcWastagePct, calcVariance, calcPrimeCost,
} from '../firebase/costAnalysisService';
import { getFinanceSummary } from '../firebase/financeService';
import { getInventory, calcInventoryValue } from '../firebase/inventoryService';
import { getExpenses } from '../firebase/expenseService';
import { getRecipes } from '../firebase/recipeService';
import { exportToExcel, importFromExcel, downloadSampleFile, printArea, exportToPDF } from '../utils/excelUtils';

const EMPTY = {
  openingStock: 0,
  closingStock: 0,
  purchases: 0,
  revenue: 0,
  laborCost: 0,
  wasteQty: 0,
  totalQty: 0,
  theoreticalPct: 0,
  notes: '',
};

const Field = ({ label, value, onChange, suffix = 'د.ك', readOnly, hint }) => (
  <div className="form-group">
    <label className="form-label">{label}{readOnly && <span style={{ color:'#0d9488', fontSize:'.7rem' }}> (تلقائى)</span>}</label>
    <div style={{ position:'relative' }}>
      <input type="number" step="0.001" className="form-control"
        value={value} onChange={e => onChange(Number(e.target.value) || 0)}
        readOnly={readOnly}
        style={{ paddingLeft: 50, background: readOnly ? '#f8fafc' : 'white' }} />
      <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', fontSize:'.78rem' }}>{suffix}</span>
    </div>
    {hint && <div style={{ fontSize:'.72rem', color:'#94a3b8', marginTop:4 }}>{hint}</div>}
  </div>
);

const KPI = ({ label, value, suffix = 'د.ك', color = '#0f172a', formula, big }) => (
  <div className="stat-card" style={{ borderRight: `3px solid ${color}` }}>
    <div className="stat-label">{label}</div>
    <div className="stat-value" style={{ color, fontSize: big ? '1.6rem' : '1.3rem' }}>
      {typeof value === 'number' ? value.toFixed(suffix === '%' ? 2 : 3) : value} {suffix}
    </div>
    {formula && <div style={{ fontSize:'.7rem', color:'#94a3b8', marginTop:4, fontFamily:'monospace' }}>{formula}</div>}
  </div>
);

export default function CostAnalysisPage() {
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0,7));
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState([]);
  const fileRef = useRef(null);

  // Selling price calculator
  const [recipes, setRecipes] = useState([]);
  const [spInput, setSpInput] = useState({ recipeCost: 0, targetPct: 30, recipeId: '' });

  const load = async () => {
    setLoading(true);
    const [saved, summary, inv, expenses, all, recipesData] = await Promise.all([
      getCostAnalysis(monthYear),
      getFinanceSummary(monthYear),
      getInventory(),
      getExpenses(monthYear),
      getAllCostAnalyses(),
      getRecipes(),
    ]);

    const closingStock = calcInventoryValue(inv);
    const laborFromExpenses = expenses
      .filter(e => e.category === 'salaries')
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    if (saved) {
      setData({ ...EMPTY, ...saved });
    } else {
      // Try to seed opening stock from previous month's closing
      const prevDate = new Date(monthYear + '-01');
      prevDate.setMonth(prevDate.getMonth() - 1);
      const prev = all.find(a => a.monthYear === prevDate.toISOString().slice(0,7));
      setData({
        ...EMPTY,
        openingStock: prev?.closingStock || 0,
        closingStock,
        purchases: summary.purchaseTotal || 0,
        revenue: summary.revenue || 0,
        laborCost: laborFromExpenses,
      });
    }

    setHistory(all);
    setRecipes(recipesData);
    setLoading(false);
  };

  useEffect(() => { load(); }, [monthYear]);

  const refreshAuto = async () => {
    const [summary, inv, expenses] = await Promise.all([
      getFinanceSummary(monthYear),
      getInventory(),
      getExpenses(monthYear),
    ]);
    const closing = calcInventoryValue(inv);
    const labor = expenses.filter(e => e.category === 'salaries')
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    setData(p => ({
      ...p,
      closingStock: closing,
      purchases: summary.purchaseTotal || 0,
      revenue: summary.revenue || 0,
      laborCost: labor,
    }));
    setMsg('تم تحديث البيانات التلقائية');
    setTimeout(() => setMsg(''), 2000);
  };

  // ── KPI Calculations ──
  const cogs = calcCOGS(data.openingStock, data.purchases, data.closingStock);
  const foodCostPct = calcFoodCostPct(cogs, data.revenue);
  const grossProfit = calcGrossProfit(data.revenue, cogs);
  const grossProfitPct = data.revenue ? (grossProfit / data.revenue) * 100 : 0;
  const wastagePct = calcWastagePct(data.wasteQty, data.totalQty);
  const variance = calcVariance(foodCostPct, data.theoreticalPct);
  const primeCost = calcPrimeCost(cogs, data.laborCost);
  const primeCostPct = data.revenue ? (primeCost / data.revenue) * 100 : 0;

  const handleSave = async () => {
    setSaving(true);
    await saveCostAnalysis(monthYear, {
      ...data,
      // also persist computed values for historical reference
      cogs, foodCostPct, grossProfit, primeCost, variance, wastagePct,
    });
    setSaving(false);
    setMsg('✅ تم الحفظ');
    setTimeout(() => setMsg(''), 2000);
    const all = await getAllCostAnalyses();
    setHistory(all);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('حذف تحليل هذا الشهر؟')) return;
    await deleteCostAnalysis(id);
    if (id === monthYear) setData(EMPTY);
    const all = await getAllCostAnalyses();
    setHistory(all);
  };

  const handleTemplate = () => {
    downloadSampleFile(
      ['الشهر', 'مخزون أول الفترة', 'المشتريات', 'مخزون آخر الفترة', 'الإيرادات',
       'تكلفة العمالة', 'كمية الهدر', 'إجمالى الكمية', 'Theoretical %', 'ملاحظات'],
      {
        'الشهر': '2026-01', 'مخزون أول الفترة': 5000, 'المشتريات': 12000,
        'مخزون آخر الفترة': 4500, 'الإيرادات': 45000, 'تكلفة العمالة': 8000,
        'كمية الهدر': 50, 'إجمالى الكمية': 1000, 'Theoretical %': 28, 'ملاحظات': 'يناير'
      },
      'cost_analysis_template.xlsx'
    );
  };

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const count = await bulkImportCostAnalysis(rows);
      setMsg(`✅ تم استيراد ${count} شهر`);
      const all = await getAllCostAnalyses();
      setHistory(all);
      load();
    } catch (err) { setMsg('فشل الاستيراد: ' + err.message); }
    e.target.value = '';
    setTimeout(() => setMsg(''), 3000);
  };

  const handleExport = () => {
    const rows = [{
      'الشهر': monthYear,
      'مخزون أول الفترة': data.openingStock.toFixed(3),
      'المشتريات': data.purchases.toFixed(3),
      'مخزون آخر الفترة': data.closingStock.toFixed(3),
      'COGS': cogs.toFixed(3),
      'الإيرادات': data.revenue.toFixed(3),
      'Food Cost %': foodCostPct.toFixed(2),
      'Theoretical %': data.theoreticalPct.toFixed(2),
      'Variance': variance.toFixed(2),
      'الربح الإجمالى': grossProfit.toFixed(3),
      'Gross Profit %': grossProfitPct.toFixed(2),
      'تكلفة العمالة': data.laborCost.toFixed(3),
      'Prime Cost': primeCost.toFixed(3),
      'Prime Cost %': primeCostPct.toFixed(2),
      'Waste Qty': data.wasteQty,
      'Total Qty': data.totalQty,
      'Wastage %': wastagePct.toFixed(2),
    }];
    exportToExcel(rows, `cost_analysis_${monthYear}.xlsx`, 'تحليل التكاليف');
  };

  // Selling price calculator
  const handleSpRecipe = (id) => {
    const r = recipes.find(x => x.id === id);
    setSpInput(p => ({ ...p, recipeId: id, recipeCost: r ? Number(r.totalCost || 0) : 0 }));
  };
  const suggestedPrice = calcSellingPrice(spInput.recipeCost, spInput.targetPct);

  if (loading) return <div className="loading"><div className="spinner" />جاري التحميل...</div>;

  // Color helpers
  const fcColor = foodCostPct > 35 ? '#dc2626' : foodCostPct > 28 ? '#f59e0b' : '#0d9488';
  const varColor = Math.abs(variance) > 3 ? '#dc2626' : Math.abs(variance) > 1 ? '#f59e0b' : '#0d9488';
  const primeColor = primeCostPct > 65 ? '#dc2626' : primeCostPct > 55 ? '#f59e0b' : '#0d9488';

  return (
    <div>
      <div className="page-header">
        <div><h2>📊 تحليل التكاليف</h2><div className="breadcrumb">المالية والعمليات / تحليل التكاليف</div></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input type="month" className="form-control" value={monthYear}
            onChange={e => setMonthYear(e.target.value)} style={{ maxWidth:180 }} />
          <button className="btn btn-ghost" onClick={refreshAuto}>🔄 تحديث تلقائى</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>📥 استيراد</button>
          <button className="btn btn-ghost" onClick={handleExport}>📤 Excel</button>
          <button className="btn btn-ghost" onClick={handleTemplate}>📋 قالب</button>
          <button className="btn btn-ghost" onClick={() => exportToPDF('ca-print', 'تحليل التكاليف')}>📄 PDF</button>
          <button className="btn btn-ghost" onClick={() => printArea('ca-print', 'تحليل التكاليف')}>🖨️ طباعة</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'جاري الحفظ...' : '💾 حفظ الشهر'}
          </button>
        </div>
      </div>

      <div className="page-body" id="ca-print">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div className="alert alert-info fade-in" style={{ marginBottom:16 }}>
          💡 <strong>كيف تشتغل:</strong> الحقول الـ <strong>"تلقائى"</strong> بتتجلب من النظام (إيرادات/مشتريات/مخزون/عمالة من فئة الرواتب). عدّلها يدوياً لو محتاج. اضغط <strong>"حفظ الشهر"</strong> علشان تثبّت سناب-شوت تقدر ترجع له بعدين.
        </div>

        {/* ── Inputs Section ── */}
        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-header"><h3>📥 المدخلات</h3></div>
          <div className="card-body">
            <h4 style={{ color:'#0d9488', marginBottom:10 }}>أ. بيانات المخزون والمبيعات</h4>
            <div className="form-grid col-3" style={{ gap:12 }}>
              <Field label="مخزون أول الفترة (Opening Stock)" value={data.openingStock}
                onChange={v => setData(p => ({...p, openingStock: v}))}
                hint="قيمة المخزون فى بداية الشهر — تلقائياً من إقفال الشهر السابق" />
              <Field label="المشتريات (Purchases)" value={data.purchases}
                onChange={v => setData(p => ({...p, purchases: v}))}
                readOnly hint="مجموع المشتريات الشهرية" />
              <Field label="مخزون آخر الفترة (Closing Stock)" value={data.closingStock}
                onChange={v => setData(p => ({...p, closingStock: v}))}
                hint="قيمة المخزون الحالى — يدوى لو عملت جرد" />
              <Field label="الإيرادات (Revenue)" value={data.revenue}
                onChange={v => setData(p => ({...p, revenue: v}))}
                readOnly hint="مجموع المدفوعات على الاشتراكات" />
            </div>

            <h4 style={{ color:'#0d9488', margin:'20px 0 10px' }}>ب. العمالة والهدر</h4>
            <div className="form-grid col-3" style={{ gap:12 }}>
              <Field label="تكلفة العمالة (Labor Cost)" value={data.laborCost}
                onChange={v => setData(p => ({...p, laborCost: v}))}
                hint="من فئة الرواتب فى المصروفات" />
              <Field label="كمية الهدر (Waste Qty)" value={data.wasteQty}
                onChange={v => setData(p => ({...p, wasteQty: v}))}
                suffix="وحدة" hint="جرام/كيلو/قطعة — اختيارى" />
              <Field label="إجمالى الكمية (Total Qty)" value={data.totalQty}
                onChange={v => setData(p => ({...p, totalQty: v}))}
                suffix="وحدة" hint="نفس وحدة الهدر" />
            </div>

            <h4 style={{ color:'#0d9488', margin:'20px 0 10px' }}>ج. النسبة المعيارية</h4>
            <div className="form-grid col-3" style={{ gap:12 }}>
              <Field label="Theoretical Cost %" value={data.theoreticalPct}
                onChange={v => setData(p => ({...p, theoreticalPct: v}))}
                suffix="%" hint="النسبة المستهدفة من الوصفات (مثلاً 28%)" />
            </div>
          </div>
        </div>

        {/* ── KPIs Section ── */}
        <h3 style={{ margin:'20px 0 12px', color:'#0d9488' }}>📊 المؤشرات المحسوبة</h3>

        <div className="stats-grid" style={{ marginBottom:12 }}>
          <KPI label="COGS — تكلفة البضاعة المباعة" value={cogs} color="#7c3aed" big
            formula="فتح + شراء − إقفال" />
          <KPI label="Food Cost %" value={foodCostPct} suffix="%" color={fcColor} big
            formula="(COGS ÷ Revenue) × 100" />
          <KPI label="الربح الإجمالى — Gross Profit" value={grossProfit} color="#0d9488" big
            formula="Revenue − COGS" />
          <KPI label="Gross Profit %" value={grossProfitPct} suffix="%" color="#0d9488"
            formula="(Profit ÷ Revenue) × 100" />
        </div>

        <div className="stats-grid" style={{ marginBottom:12 }}>
          <KPI label="Variance — الانحراف" value={variance} suffix="%" color={varColor}
            formula="Actual − Theoretical" />
          <KPI label="Wastage %" value={wastagePct} suffix="%" color={wastagePct > 5 ? '#dc2626' : '#0d9488'}
            formula="(Waste ÷ Total) × 100" />
          <KPI label="Prime Cost" value={primeCost} color="#3b82f6"
            formula="Food + Labor" />
          <KPI label="Prime Cost %" value={primeCostPct} suffix="%" color={primeColor}
            formula="(Prime ÷ Revenue) × 100" />
        </div>

        {/* Health indicators */}
        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-header"><h3>🚦 مؤشرات الأداء</h3></div>
          <div className="card-body">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:12 }}>
              <Indicator label="Food Cost %" value={foodCostPct} thresholds={[28, 35]} unit="%"
                tip={foodCostPct > 35 ? 'مرتفع — راجع التكلفة أو ارفع الأسعار' : foodCostPct > 28 ? 'متوسط — عادى للمطاعم' : 'ممتاز'} />
              <Indicator label="Prime Cost %" value={primeCostPct} thresholds={[55, 65]} unit="%"
                tip={primeCostPct > 65 ? 'خطر — Food + Labor يستهلكوا أكتر من ⅔ الإيراد' : 'صحى'} />
              <Indicator label="Variance" value={Math.abs(variance)} thresholds={[1, 3]} unit="%"
                tip={Math.abs(variance) > 3 ? 'كبير — فيه هدر/سرقة/خطأ بالمكاييل' : Math.abs(variance) > 1 ? 'مقبول' : 'ممتاز'} />
              <Indicator label="Wastage %" value={wastagePct} thresholds={[2, 5]} unit="%"
                tip={wastagePct > 5 ? 'مرتفع — راجع التخزين والتجهيز' : 'طبيعى'} />
            </div>
          </div>
        </div>

        {/* Selling Price Calculator */}
        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-header"><h3>🧮 حاسبة سعر البيع</h3></div>
          <div className="card-body">
            <div style={{ background:'#f0fdfa', padding:10, borderRadius:6, marginBottom:12, fontSize:'.85rem' }}>
              <strong>المعادلة:</strong> Selling Price = Recipe Cost ÷ Target Food Cost %
            </div>
            <div className="form-grid col-3" style={{ gap:12 }}>
              <div className="form-group">
                <label className="form-label">اختر وصفة</label>
                <select className="form-control" value={spInput.recipeId}
                  onChange={e => handleSpRecipe(e.target.value)}>
                  <option value="">-- يدوى --</option>
                  {recipes.map(r => <option key={r.id} value={r.id}>{r.name} (تكلفة {Number(r.totalCost||0).toFixed(3)} د.ك)</option>)}
                </select>
              </div>
              <Field label="تكلفة الوصفة" value={spInput.recipeCost}
                onChange={v => setSpInput(p => ({...p, recipeCost: v, recipeId: ''}))} />
              <Field label="Target Food Cost %" value={spInput.targetPct}
                onChange={v => setSpInput(p => ({...p, targetPct: v}))} suffix="%" />
            </div>
            <div style={{ marginTop:12, padding:14, background:'#0d948811', borderRadius:8, textAlign:'center' }}>
              <div style={{ color:'#64748b', fontSize:'.85rem' }}>سعر البيع المقترح</div>
              <div style={{ fontSize:'2rem', fontWeight:800, color:'#0d9488', marginTop:4 }}>
                {suggestedPrice.toFixed(3)} د.ك
              </div>
              <div style={{ fontSize:'.78rem', color:'#94a3b8', marginTop:4 }}>
                هامش ربح متوقع: {spInput.targetPct ? (100 - spInput.targetPct).toFixed(0) : 0}%
              </div>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="card">
          <div className="card-header"><h3>📅 سجل التحليلات السابقة</h3><span className="badge badge-teal">{history.length}</span></div>
          <div className="table-wrapper">
            {history.length === 0 ? <div className="empty-state"><div className="empty-icon">📊</div><h3>لا يوجد سجل</h3></div>
            : (
              <table>
                <thead><tr>
                  <th>الشهر</th><th>COGS</th><th>Food Cost %</th>
                  <th>Gross Profit</th><th>Prime Cost %</th><th>Variance</th><th></th>
                </tr></thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td><strong>{h.monthYear}</strong></td>
                      <td>{Number(h.cogs || 0).toFixed(3)}</td>
                      <td><span className="badge" style={{
                        background: (h.foodCostPct > 35 ? '#fee2e2' : h.foodCostPct > 28 ? '#fef3c7' : '#dcfce7'),
                        color: (h.foodCostPct > 35 ? '#dc2626' : h.foodCostPct > 28 ? '#92400e' : '#16a34a'),
                      }}>{Number(h.foodCostPct || 0).toFixed(1)}%</span></td>
                      <td>{Number(h.grossProfit || 0).toFixed(3)}</td>
                      <td>{h.revenue ? ((Number(h.primeCost || 0) / h.revenue) * 100).toFixed(1) : 0}%</td>
                      <td style={{ color: Math.abs(h.variance || 0) > 3 ? '#dc2626' : '#0d9488' }}>{Number(h.variance || 0).toFixed(2)}%</td>
                      <td><div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setMonthYear(h.monthYear)}>فتح</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(h.id)}>حذف</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Indicator({ label, value, thresholds, unit = '', tip }) {
  const [low, high] = thresholds;
  const status = value < low ? 'good' : value < high ? 'warn' : 'bad';
  const colors = { good: '#0d9488', warn: '#f59e0b', bad: '#dc2626' };
  const labels = { good: '🟢 ممتاز', warn: '🟡 متوسط', bad: '🔴 يحتاج مراجعة' };
  return (
    <div style={{ padding:12, border:`2px solid ${colors[status]}`, borderRadius:8, background: colors[status] + '0a' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <strong>{label}</strong>
        <span style={{ fontSize:'.78rem', color:colors[status], fontWeight:700 }}>{labels[status]}</span>
      </div>
      <div style={{ fontSize:'1.4rem', fontWeight:700, color:colors[status], margin:'6px 0' }}>{Number(value).toFixed(2)}{unit}</div>
      <div style={{ fontSize:'.78rem', color:'#64748b' }}>{tip}</div>
    </div>
  );
}
