import { useState, useEffect } from 'react';
import { getFinanceSummary, getMonthlyTrend } from '../firebase/financeService';
import { printArea, exportToExcel } from '../utils/excelUtils';

export default function FinanceDashboard() {
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0,7));
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [s, t] = await Promise.all([getFinanceSummary(monthYear), getMonthlyTrend()]);
    setSummary(s); setTrend(t);
    setLoading(false);
  };
  useEffect(() => { load(); }, [monthYear]);

  const handleExport = () => {
    if (!summary) return;
    const rows = [{
      'الشهر': monthYear,
      'الإيرادات': summary.revenue.toFixed(3),
      'المشتريات': summary.purchaseTotal.toFixed(3),
      'المصروفات': summary.expenseTotal.toFixed(3),
      'صافي الربح': summary.profit.toFixed(3),
      'هامش الربح %': summary.profitMargin,
      'قيمة المخزون': summary.inventoryValue.toFixed(3),
      'الاشتراكات النشطة': summary.activeSubs,
      'إيراد/اشتراك': summary.revenuePerSub.toFixed(3),
      'نقطة التعادل': summary.breakEvenSubs || '—',
    }];
    const trendRows = trend.map(t => ({
      'الشهر': t.label,
      'الإيراد': t.revenue.toFixed(3),
      'التكلفة': t.cost.toFixed(3),
      'الربح': t.profit.toFixed(3),
      'الاشتراكات': t.subs,
    }));
    exportToExcel([...rows, {}, ...trendRows], `finance_${monthYear}.xlsx`, 'المالية');
  };

  if (loading || !summary) {
    return <div className="loading"><div className="spinner" />جاري التحميل...</div>;
  }

  const profitClr = summary.profit > 0 ? '#0d9488' : '#dc2626';
  const maxTrend = Math.max(...trend.map(t => Math.max(t.revenue, t.cost)), 1);

  return (
    <div>
      <div className="page-header">
        <div><h2>💹 لوحة المالية</h2><div className="breadcrumb">المالية والعمليات / لوحة المالية</div></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input type="month" className="form-control" value={monthYear}
            onChange={e => setMonthYear(e.target.value)} style={{ maxWidth:200 }} />
          <button className="btn btn-ghost" onClick={handleExport}>📤 تصدير</button>
          <button className="btn btn-ghost" onClick={() => printArea('fin-print', 'تقرير المالية')}>🖨️ طباعة</button>
        </div>
      </div>

      <div className="page-body" id="fin-print">
        <div className="stats-grid" style={{ marginBottom:16 }}>
          <div className="stat-card">
            <div className="stat-label">الإيرادات</div>
            <div className="stat-value" style={{ color:'#0d9488' }}>{summary.revenue.toFixed(3)} د.ك</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">المشتريات</div>
            <div className="stat-value" style={{ color:'#f59e0b' }}>{summary.purchaseTotal.toFixed(3)} د.ك</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">المصروفات</div>
            <div className="stat-value" style={{ color:'#dc2626' }}>{summary.expenseTotal.toFixed(3)} د.ك</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">صافي الربح</div>
            <div className="stat-value" style={{ color: profitClr }}>{summary.profit.toFixed(3)} د.ك</div>
            <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginTop:4 }}>هامش {summary.profitMargin}%</div>
          </div>
        </div>

        <div className="stats-grid" style={{ marginBottom:16 }}>
          <div className="stat-card"><div className="stat-label">قيمة المخزون</div><div className="stat-value">{summary.inventoryValue.toFixed(3)} د.ك</div></div>
          <div className="stat-card"><div className="stat-label">اشتراكات نشطة</div><div className="stat-value">{summary.activeSubs}</div></div>
          <div className="stat-card"><div className="stat-label">إيراد/اشتراك</div><div className="stat-value">{summary.revenuePerSub.toFixed(3)} د.ك</div></div>
          <div className="stat-card">
            <div className="stat-label">نقطة التعادل</div>
            <div className="stat-value">{summary.breakEvenSubs || '—'}</div>
            <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginTop:4 }}>اشتراك لتغطية الثوابت</div>
          </div>
        </div>

        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-header"><h3>تفصيل المصروفات</h3></div>
          <div className="card-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <div style={{ color:'#64748b', fontSize:'0.85rem' }}>ثابتة</div>
                <div style={{ fontSize:'1.4rem', fontWeight:700, color:'#3b82f6' }}>{summary.fixedExpenses.toFixed(3)} د.ك</div>
              </div>
              <div>
                <div style={{ color:'#64748b', fontSize:'0.85rem' }}>متغيرة</div>
                <div style={{ fontSize:'1.4rem', fontWeight:700, color:'#f59e0b' }}>{summary.variableExpenses.toFixed(3)} د.ك</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>الاتجاه الشهري — آخر 6 شهور</h3></div>
          <div className="card-body">
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${trend.length},1fr)`, gap:8, alignItems:'end', height:180, marginBottom:16 }}>
              {trend.map((t, i) => (
                <div key={i} style={{ textAlign:'center' }}>
                  <div style={{ display:'flex', gap:2, alignItems:'end', justifyContent:'center', height:140 }}>
                    <div title={`إيراد: ${t.revenue.toFixed(3)}`}
                      style={{ width:14, height:`${(t.revenue / maxTrend) * 100}%`, background:'#0d9488', borderRadius:'2px 2px 0 0' }} />
                    <div title={`تكلفة: ${t.cost.toFixed(3)}`}
                      style={{ width:14, height:`${(t.cost / maxTrend) * 100}%`, background:'#dc2626', borderRadius:'2px 2px 0 0' }} />
                  </div>
                  <div style={{ fontSize:'0.72rem', color:'#64748b', marginTop:6 }}>{t.label}</div>
                </div>
              ))}
            </div>
            <table>
              <thead><tr><th>الشهر</th><th>الإيراد</th><th>التكلفة</th><th>الربح</th><th>الاشتراكات</th></tr></thead>
              <tbody>
                {trend.map((t, i) => (
                  <tr key={i}>
                    <td>{t.label}</td>
                    <td style={{ color:'#0d9488' }}>{t.revenue.toFixed(3)}</td>
                    <td style={{ color:'#dc2626' }}>{t.cost.toFixed(3)}</td>
                    <td style={{ color: t.profit > 0 ? '#0d9488' : '#dc2626', fontWeight:700 }}>{t.profit.toFixed(3)}</td>
                    <td>{t.subs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
