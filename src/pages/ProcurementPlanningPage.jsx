import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getAllSubscriptions } from '../firebase/subscriptionService';
import { getClients } from '../firebase/clientService';
import { buildProductionPlan } from '../firebase/productionService';
import { getSuppliers } from '../firebase/supplierService';
import { exportToExcel, printArea, exportToPDF, exportMultiSheet } from '../utils/excelUtils';

export default function ProcurementPlanningPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [endDate, setEndDate] = useState('');  // optional range
  const [plan, setPlan] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [building, setBuilding] = useState(false);
  const [msg, setMsg] = useState('');
  const [bufferPct, setBufferPct] = useState(10); // safety stock %

  useEffect(() => { getSuppliers().then(setSuppliers); }, []);

  const handleBuild = async () => {
    setBuilding(true);
    setPlan(null);
    try {
      const [cdmSnap, mealsSnap, allSubs, clients] = await Promise.all([
        getDocs(collection(db, 'clientDailyMeals')),
        getDocs(collection(db, 'meals')),
        getAllSubscriptions(),
        getClients(),
      ]);

      // Build single-day or range
      const dates = [];
      if (endDate && endDate >= date) {
        const start = new Date(date), end = new Date(endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().slice(0,10));
        }
      } else {
        dates.push(date);
      }

      // Aggregate plans across all dates
      const merged = {
        date: dates.length === 1 ? date : `${date} → ${endDate}`,
        totalMeals: 0, totalCost: 0,
        ingredients: [],
        mealBreakdown: [],
        mealsWithoutRecipe: new Set(),
      };
      const ingMap = {};

      for (const d of dates) {
        const p = await buildProductionPlan(d, {
          clientDailyMeals: cdmSnap.docs.map(x => ({ id: x.id, ...x.data() })),
          meals: mealsSnap.docs.map(x => ({ id: x.id, ...x.data() })),
          subscriptions: allSubs,
          clients,
        });
        merged.totalMeals += p.totalMeals;
        merged.totalCost += p.totalCost;
        p.mealsWithoutRecipe.forEach(m => merged.mealsWithoutRecipe.add(m));
        p.ingredients.forEach(ing => {
          const key = ing.ingredientId || ing.name;
          if (!ingMap[key]) ingMap[key] = { ...ing, totalGrams: 0, demandInUnit: 0, cost: 0 };
          ingMap[key].totalGrams += ing.totalGrams;
          ingMap[key].demandInUnit += ing.demandInUnit;
          ingMap[key].cost += ing.cost;
        });
        p.mealBreakdown.forEach(m => merged.mealBreakdown.push({ ...m, date: d }));
      }
      merged.ingredients = Object.values(ingMap);
      merged.mealsWithoutRecipe = [...merged.mealsWithoutRecipe];

      // Apply buffer (safety stock %) and recompute shortage
      const buffer = (Number(bufferPct) || 0) / 100;
      merged.ingredients.forEach(ing => {
        const need = ing.demandInUnit * (1 + buffer);
        ing.demandWithBuffer = need;
        ing.shortage = Math.max(0, need - (ing.inStock || 0));
        ing.shortageCost = ing.shortage * (ing.costPerUnit || 0);
        ing.sufficient = ing.shortage === 0;
      });

      setPlan(merged);
    } catch (err) {
      setMsg('فشل البناء: ' + err.message);
    }
    setBuilding(false);
  };

  if (!plan) {
    // Initial state
    return (
      <div>
        <div className="page-header">
          <div><h2>🛒 تخطيط المشتريات</h2><div className="breadcrumb">المالية والعمليات / تخطيط المشتريات</div></div>
        </div>
        <div className="page-body">
          {msg && <div className="alert alert-warning fade-in">{msg}</div>}
          <div className="alert alert-info fade-in" style={{ marginBottom:16 }}>
            💡 <strong>كيف بتشتغل:</strong> الصفحة بتقرأ من <strong>تقرير التصنيع التجميعى</strong> الوجبات المطلوبة لتاريخ معين (أو فترة)، وتشوف مكوناتها من الوصفات، تقارن بالمخزون، وتطلعلك قائمتين: ✅ <strong>متوفر</strong> و 🛒 <strong>يجب شراؤه</strong>. ساعة ما تضيف وصفات للوجبات بتشتغل تلقائياً — مفيش حاجة محتاجة تتعدّل.
          </div>

          <div className="card">
            <div className="card-header"><h3>اختر الفترة</h3></div>
            <div className="card-body">
              <div className="form-grid col-3" style={{ gap:12 }}>
                <div className="form-group">
                  <label className="form-label">من تاريخ *</label>
                  <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">إلى تاريخ <span style={{ color:'#94a3b8', fontSize:'.78rem' }}>(اختيارى — لفترة)</span></label>
                  <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">هامش أمان (Buffer)</label>
                  <input type="number" className="form-control" value={bufferPct}
                    onChange={e => setBufferPct(e.target.value)} suffix="%" />
                  <div style={{ fontSize:'.72rem', color:'#94a3b8', marginTop:4 }}>زيادة % لتغطية الهدر/الزيادة (مثلاً 10%)</div>
                </div>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleBuild} disabled={building}>
                {building ? 'جاري الحساب...' : '🔨 احسب احتياجات الشراء'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sufficient = plan.ingredients.filter(i => i.sufficient);
  const missing = plan.ingredients.filter(i => !i.sufficient);
  const totalShortageCost = missing.reduce((s, i) => s + (i.shortageCost || 0), 0);

  // Group missing by category (for purchasing organization)
  const byCategory = {};
  missing.forEach(i => {
    const cat = i.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(i);
  });

  // Export missing as procurement order (one row per ingredient)
  const handleExportMissing = () => {
    if (missing.length === 0) { setMsg('لا توجد مكونات ناقصة'); setTimeout(() => setMsg(''), 2000); return; }
    const rows = missing.map(i => ({
      'المكون': i.name,
      'الكمية المطلوبة': i.demandWithBuffer.toFixed(3) + ' ' + i.unit,
      'فى المخزون': i.inStock + ' ' + i.unit,
      'الكمية الناقصة': i.shortage.toFixed(3) + ' ' + i.unit,
      'تكلفة الوحدة المتوقعة': (i.costPerUnit || 0).toFixed(3) + ' د.ك',
      'إجمالى التكلفة المتوقعة': (i.shortageCost || 0).toFixed(3) + ' د.ك',
      'التصنيف': i.category,
    }));
    exportToExcel(rows, `procurement_order_${plan.date.replace(' → ', '_to_')}.xlsx`, 'أمر شراء');
  };

  // Export full plan (all 3 sections in 3 sheets)
  const handleExportFull = () => {
    const sufficientRows = sufficient.map(i => ({
      'المكون': i.name,
      'المطلوب': i.demandWithBuffer.toFixed(3) + ' ' + i.unit,
      'المتوفر': i.inStock + ' ' + i.unit,
      'فائض': (i.inStock - i.demandWithBuffer).toFixed(3) + ' ' + i.unit,
    }));
    const missingRows = missing.map(i => ({
      'المكون': i.name,
      'المطلوب': i.demandWithBuffer.toFixed(3) + ' ' + i.unit,
      'المتوفر': i.inStock + ' ' + i.unit,
      'الناقص': i.shortage.toFixed(3) + ' ' + i.unit,
      'تكلفة الوحدة': (i.costPerUnit || 0).toFixed(3) + ' د.ك',
      'إجمالى الشراء': (i.shortageCost || 0).toFixed(3) + ' د.ك',
    }));
    const mealsRows = plan.mealBreakdown.map(m => ({
      'التاريخ': m.date || plan.date,
      'الوجبة': m.mealName,
      'الحجم': m.grams + ' جرام',
      'العدد': m.count,
    }));
    exportMultiSheet([
      { name: 'يجب شراؤه', rows: missingRows.length ? missingRows : [{ ملاحظة: 'كل المكونات متوفرة' }] },
      { name: 'متوفر بالمخزون', rows: sufficientRows.length ? sufficientRows : [{ ملاحظة: '—' }] },
      { name: 'تفصيل الوجبات', rows: mealsRows },
    ], `procurement_plan_${plan.date.replace(' → ', '_to_')}.xlsx`);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🛒 تخطيط المشتريات</h2>
          <div className="breadcrumb">
            <span style={{ cursor:'pointer', color:'#0d9488' }} onClick={() => setPlan(null)}>← العودة</span>
            {' / '} {plan.date}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setPlan(null)}>🔄 إعادة الحساب</button>
          <button className="btn btn-ghost" onClick={handleExportMissing}>📤 تصدير قائمة الشراء</button>
          <button className="btn btn-ghost" onClick={handleExportFull}>📤 تصدير الخطة الكاملة</button>
          <button className="btn btn-ghost" onClick={() => exportToPDF('proc-print', 'خطة المشتريات')}>📄 PDF</button>
          <button className="btn btn-ghost" onClick={() => printArea('proc-print', 'خطة المشتريات')}>🖨️ طباعة</button>
        </div>
      </div>

      <div className="page-body" id="proc-print">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div className="stats-grid" style={{ marginBottom:16 }}>
          <div className="stat-card"><div className="stat-label">إجمالى الوجبات</div><div className="stat-value">{plan.totalMeals}</div></div>
          <div className="stat-card"><div className="stat-label">المكونات الإجمالية</div><div className="stat-value">{plan.ingredients.length}</div></div>
          <div className="stat-card">
            <div className="stat-label">✅ متوفر</div>
            <div className="stat-value" style={{ color:'#0d9488' }}>{sufficient.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">🛒 يجب شراؤه</div>
            <div className="stat-value" style={{ color: missing.length ? '#dc2626' : '#0d9488' }}>{missing.length}</div>
          </div>
        </div>

        {plan.mealsWithoutRecipe.length > 0 && (
          <div className="alert alert-warning fade-in" style={{ marginBottom:16, background:'#fef3c7', borderColor:'#f59e0b', color:'#92400e' }}>
            ⚠️ <strong>{plan.mealsWithoutRecipe.length} وجبة بدون وصفة:</strong> {plan.mealsWithoutRecipe.slice(0,5).join('، ')}
            {plan.mealsWithoutRecipe.length > 5 && ` (و ${plan.mealsWithoutRecipe.length - 5} أخرى)`}
            — مكوناتها مش متحسبة فى الخطة. أضف وصفات من <strong style={{ cursor:'pointer', textDecoration:'underline' }}
              onClick={() => navigate('/meal-recipes')}>وصفات الوجبات</strong>
          </div>
        )}

        {plan.ingredients.length === 0 && plan.mealsWithoutRecipe.length === 0 && (
          <div className="alert alert-info fade-in" style={{ marginBottom:16 }}>
            ℹ️ لا توجد وجبات مطلوبة فى هذا التاريخ — تأكد من اختيارات العملاء فى تقرير التصنيع
          </div>
        )}

        {/* MISSING — يجب شراؤه */}
        {missing.length > 0 && (
          <div className="card" style={{ marginBottom:16, borderTop:'4px solid #dc2626' }}>
            <div className="card-header" style={{ background:'#fef2f2' }}>
              <h3 style={{ color:'#dc2626' }}>🛒 يجب شراؤه — قائمة المشتريات</h3>
              <span className="badge" style={{ background:'#fee2e2', color:'#dc2626' }}>
                {missing.length} مكون · {totalShortageCost.toFixed(3)} د.ك
              </span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr>
                  <th>#</th><th>المكون</th><th>التصنيف</th><th>المطلوب</th>
                  <th>المتوفر</th><th>الناقص</th><th>تكلفة الوحدة</th><th>إجمالى الشراء</th>
                </tr></thead>
                <tbody>
                  {missing.map((ing, i) => (
                    <tr key={i} style={{ background:'#fef2f2' }}>
                      <td>{i+1}</td>
                      <td><strong>{ing.name}</strong></td>
                      <td>{ing.category}</td>
                      <td>{ing.demandWithBuffer.toFixed(3)} {ing.unit}</td>
                      <td>{ing.inStock} {ing.unit}</td>
                      <td style={{ color:'#dc2626', fontWeight:700 }}>⚠️ {ing.shortage.toFixed(3)} {ing.unit}</td>
                      <td>{(ing.costPerUnit || 0).toFixed(3)} د.ك</td>
                      <td><strong style={{ color:'#dc2626' }}>{(ing.shortageCost || 0).toFixed(3)} د.ك</strong></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:'#fee2e2', fontWeight:700 }}>
                    <td colSpan={7}>الإجمالى المتوقع للشراء</td>
                    <td style={{ color:'#dc2626' }}>{totalShortageCost.toFixed(3)} د.ك</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Group by category for purchasing */}
            {Object.keys(byCategory).length > 1 && (
              <div className="card-body" style={{ borderTop:'1px solid #e2e8f0' }}>
                <h4 style={{ marginBottom:10, color:'#64748b' }}>التوزيع حسب التصنيف (للتعامل مع الموردين)</h4>
                {Object.entries(byCategory).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom:8, padding:8, background:'#f8fafc', borderRadius:6 }}>
                    <strong>{cat}</strong>: {items.length} مكون · إجمالى {items.reduce((s, i) => s + (i.shortageCost || 0), 0).toFixed(3)} د.ك
                  </div>
                ))}
              </div>
            )}

            <div className="card-body" style={{ borderTop:'1px solid #e2e8f0', textAlign:'center' }}>
              <button className="btn btn-primary" onClick={() => navigate('/purchases')}>
                📝 الذهاب لصفحة المشتريات لإنشاء فاتورة
              </button>
              <div style={{ fontSize:'.78rem', color:'#94a3b8', marginTop:6 }}>
                صدّر القائمة أعلاه لـ Excel وأرسلها للموردين، أو أنشئ فاتورة شراء يدوية
              </div>
            </div>
          </div>
        )}

        {/* SUFFICIENT — متوفر */}
        {sufficient.length > 0 && (
          <div className="card" style={{ borderTop:'4px solid #0d9488' }}>
            <div className="card-header" style={{ background:'#f0fdfa' }}>
              <h3 style={{ color:'#0d9488' }}>✅ متوفر بالمخزون</h3>
              <span className="badge" style={{ background:'#dcfce7', color:'#16a34a' }}>{sufficient.length} مكون</span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr>
                  <th>#</th><th>المكون</th><th>المطلوب</th><th>المتوفر</th><th>فائض</th>
                </tr></thead>
                <tbody>
                  {sufficient.map((ing, i) => (
                    <tr key={i}>
                      <td>{i+1}</td>
                      <td><strong>{ing.name}</strong></td>
                      <td>{ing.demandWithBuffer.toFixed(3)} {ing.unit}</td>
                      <td>{ing.inStock} {ing.unit}</td>
                      <td style={{ color:'#0d9488' }}>+{(ing.inStock - ing.demandWithBuffer).toFixed(3)} {ing.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
