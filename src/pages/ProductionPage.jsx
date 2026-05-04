import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getAllSubscriptions } from '../firebase/subscriptionService';
import { getClients } from '../firebase/clientService';
import {
  buildProductionPlan, commitProduction, getProductions, deleteProduction,
} from '../firebase/productionService';
import { exportToExcel, printArea, exportToPDF } from '../utils/excelUtils';

export default function ProductionPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [plan, setPlan] = useState(null);
  const [building, setBuilding] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState('');

  const loadHistory = async () => setHistory(await getProductions());
  useEffect(() => { loadHistory(); }, []);

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
      const result = await buildProductionPlan(date, {
        clientDailyMeals: cdmSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        meals: mealsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        subscriptions: allSubs,
        clients,
      });
      setPlan(result);
    } catch (err) {
      setMsg('فشل البناء: ' + err.message);
    }
    setBuilding(false);
  };

  const handleCommit = async () => {
    if (!plan) return;
    if (plan.mealsWithoutRecipe.length > 0) {
      const ok = window.confirm(
        `⚠️ ${plan.mealsWithoutRecipe.length} وجبة بدون وصفة لن يتم خصمها.\n\nاستكمال؟`
      );
      if (!ok) return;
    }
    if (!window.confirm('سيتم خصم المكونات من المخزون. هل تريد المتابعة؟')) return;
    setCommitting(true);
    await commitProduction(plan);
    setCommitting(false);
    setMsg(`تم تسجيل الإنتاج وخصم ${plan.ingredients.length} مكون من المخزون`);
    setPlan(null);
    loadHistory();
    setTimeout(() => setMsg(''), 4000);
  };

  const handleDelete = async (id) => {
    if (window.confirm('حذف السجل؟ (المخزون لن يرجع تلقائياً)')) {
      await deleteProduction(id);
      loadHistory();
    }
  };

  const handleExport = () => {
    if (!plan) return;
    const rows = plan.ingredients.map(i => ({
      'المكون': i.name,
      'المطلوب': i.demandInUnit.toFixed(3) + ' ' + i.unit,
      'فى المخزون': i.inStock + ' ' + i.inStockUnit,
      'النقص': i.shortage > 0 ? i.shortage.toFixed(3) + ' ' + i.unit : '—',
      'تكلفة الوحدة': i.costPerUnit.toFixed(3) + ' د.ك',
      'إجمالى التكلفة': i.cost.toFixed(3) + ' د.ك',
    }));
    exportToExcel(rows, `production_${date}.xlsx`, 'خطة الإنتاج');
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>🏭 الإنتاج اليومى</h2><div className="breadcrumb">المالية والعمليات / الإنتاج</div></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input type="date" className="form-control" value={date}
            onChange={e => setDate(e.target.value)} style={{ maxWidth:180 }} />
          <button className="btn btn-primary" onClick={handleBuild} disabled={building}>
            {building ? 'جاري البناء...' : '🔨 بناء خطة الإنتاج'}
          </button>
          {plan && <>
            <button className="btn btn-ghost" onClick={handleExport}>📤 Excel</button>
            <button className="btn btn-ghost" onClick={() => exportToPDF('prod-print', 'خطة الإنتاج')}>📄 PDF</button>
            <button className="btn btn-ghost" onClick={() => printArea('prod-print', 'خطة الإنتاج')}>🖨️ طباعة</button>
          </>}
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div className="alert alert-info fade-in" style={{ marginBottom:16 }}>
          💡 <strong>كيف بتشتغل:</strong> الصفحة بتقرأ من <strong>تقرير التصنيع التجميعى</strong> (مش بتعدّل عليه) وتحسب المكونات اللازمة بناءً على وصفات الوجبات. لما تضغط "خصم"، المخزون بيتخصم وبيتسجل record جديد. <strong>التقارير القديمة لا تتأثر إطلاقاً.</strong>
        </div>

        {plan && (
          <div id="prod-print">
            <div className="stats-grid" style={{ marginBottom:16 }}>
              <div className="stat-card"><div className="stat-label">إجمالى الوجبات</div><div className="stat-value">{plan.totalMeals}</div></div>
              <div className="stat-card"><div className="stat-label">عدد المكونات</div><div className="stat-value">{plan.ingredients.length}</div></div>
              <div className="stat-card"><div className="stat-label">التكلفة الإجمالية</div><div className="stat-value" style={{ color:'#0d9488' }}>{plan.totalCost.toFixed(3)} د.ك</div></div>
              <div className="stat-card">
                <div className="stat-label">وجبات بلا وصفة</div>
                <div className="stat-value" style={{ color: plan.mealsWithoutRecipe.length ? '#dc2626' : '#0d9488' }}>{plan.mealsWithoutRecipe.length}</div>
              </div>
            </div>

            {plan.mealsWithoutRecipe.length > 0 && (
              <div className="alert alert-warning fade-in" style={{ marginBottom:16, background:'#fef3c7', borderColor:'#f59e0b', color:'#92400e' }}>
                ⚠️ <strong>{plan.mealsWithoutRecipe.length} وجبة بدون وصفة:</strong> {plan.mealsWithoutRecipe.slice(0,5).join('، ')}
                {plan.mealsWithoutRecipe.length > 5 && ` (و ${plan.mealsWithoutRecipe.length - 5} أخرى)`}
                — أضف وصفاتها من <strong>وصفات الوجبات</strong>
              </div>
            )}

            {plan.conversionWarnings?.length > 0 && (
              <div className="alert fade-in" style={{ marginBottom:16, background:'#fee2e2', borderColor:'#dc2626', color:'#991b1b', padding:'10px 14px', borderRadius:8, border:'1px solid' }}>
                ⚠️ <strong>تحذير وحدات قياس:</strong>
                <ul style={{ margin:'6px 0 0 20px' }}>
                  {plan.conversionWarnings.map((w, i) => <li key={i} style={{ fontSize:'.85rem' }}>{w}</li>)}
                </ul>
                <div style={{ fontSize:'.78rem', marginTop:6 }}>
                  المكونات دى تكلفتها مش متحسبة (= 0) — افتح المخزون و املأ <strong>"وزن الوحدة"</strong>
                </div>
              </div>
            )}

            <div className="card" style={{ marginBottom:16 }}>
              <div className="card-header">
                <h3>المكونات المطلوبة</h3>
                <button className="btn btn-primary" onClick={handleCommit} disabled={committing || plan.ingredients.length === 0}>
                  {committing ? 'جاري الخصم...' : '✅ خصم وسجّل الإنتاج'}
                </button>
              </div>
              <div className="table-wrapper">
                {plan.ingredients.length === 0 ? <div className="empty-state"><div className="empty-icon">📦</div><h3>لا توجد مكونات للخصم</h3></div>
                : (
                  <table>
                    <thead><tr>
                      <th>#</th><th>المكون</th><th>المطلوب</th>
                      <th>فى المخزون</th><th>النقص</th><th>تكلفة الوحدة</th><th>إجمالى التكلفة</th>
                    </tr></thead>
                    <tbody>
                      {plan.ingredients.map((ing, i) => (
                        <tr key={i} style={ing.shortage > 0 ? { background:'#fef2f2' } : {}}>
                          <td>{i+1}</td>
                          <td><strong>{ing.name}</strong></td>
                          <td>{ing.demandInUnit.toFixed(3)} {ing.unit}</td>
                          <td>{ing.inStock} {ing.inStockUnit}</td>
                          <td style={{ color: ing.shortage > 0 ? '#dc2626' : '#0d9488' }}>
                            {ing.shortage > 0 ? `⚠️ ${ing.shortage.toFixed(3)} ${ing.unit}` : '—'}
                          </td>
                          <td>{ing.costPerUnit.toFixed(3)} د.ك</td>
                          <td><strong>{ing.cost.toFixed(3)} د.ك</strong></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background:'#f0fdfa', fontWeight:700 }}>
                        <td colSpan={6}>الإجمالى</td>
                        <td style={{ color:'#0d9488' }}>{plan.totalCost.toFixed(3)} د.ك</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>تفصيل الوجبات</h3></div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>الوجبة</th><th>الحجم (جرام)</th><th>العدد</th></tr></thead>
                  <tbody>
                    {plan.mealBreakdown.map((m, i) => (
                      <tr key={i}><td>{m.mealName}</td><td>{m.grams}</td><td><strong>{m.count}</strong></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop:16 }}>
          <div className="card-header"><h3>سجل الإنتاج السابق</h3><span className="badge badge-teal">{history.length}</span></div>
          <div className="table-wrapper">
            {history.length === 0 ? <div className="empty-state"><div className="empty-icon">🏭</div><h3>لا يوجد سجل إنتاج</h3></div>
            : (
              <table>
                <thead><tr><th>#</th><th>التاريخ</th><th>الوجبات</th><th>المكونات</th><th>التكلفة</th><th></th></tr></thead>
                <tbody>
                  {history.map((p, i) => (
                    <tr key={p.id}>
                      <td>{i+1}</td><td>{p.date}</td>
                      <td>{p.totalMeals}</td>
                      <td>{p.ingredients?.length || 0}</td>
                      <td><strong>{Number(p.totalCost || 0).toFixed(3)} د.ك</strong></td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>حذف</button></td>
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
