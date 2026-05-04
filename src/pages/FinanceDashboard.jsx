import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFinanceSummary, getMonthlyTrend } from '../firebase/financeService';
import { printArea, exportToExcel, exportToPDF } from '../utils/excelUtils';
import { useLang } from '../LanguageContext';

const clickCard = { cursor: 'pointer', transition: 'all 0.15s' };

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const { t, isAr } = useLang();
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [s, tr] = await Promise.all([getFinanceSummary(monthYear), getMonthlyTrend()]);
    setSummary(s); setTrend(tr);
    setLoading(false);
  };
  useEffect(() => { load(); }, [monthYear]);

  const kwd = (n) => `${Number(n || 0).toFixed(3)} ${isAr ? 'د.ك' : 'KWD'}`;

  const handleExport = () => {
    if (!summary) return;
    const rows = [{
      [isAr ? 'الشهر' : 'Month']: monthYear,
      [isAr ? 'الإيرادات' : 'Revenue']: summary.revenue.toFixed(3),
      [isAr ? 'المشتريات' : 'Purchases']: summary.purchaseTotal.toFixed(3),
      [isAr ? 'المصروفات' : 'Expenses']: summary.expenseTotal.toFixed(3),
      [isAr ? 'صافي الربح' : 'Net Profit']: summary.profit.toFixed(3),
      [isAr ? 'هامش الربح %' : 'Profit Margin %']: summary.profitMargin,
      [isAr ? 'قيمة المخزون' : 'Inventory Value']: summary.inventoryValue.toFixed(3),
      [isAr ? 'الاشتراكات النشطة' : 'Active Subs']: summary.activeSubs,
      [isAr ? 'إيراد/اشتراك' : 'Rev/Sub']: summary.revenuePerSub.toFixed(3),
      [isAr ? 'نقطة التعادل' : 'Break-Even']: summary.breakEvenSubs || '—',
    }];
    const trendRows = trend.map(tr => ({
      [isAr ? 'الشهر' : 'Month']: tr.label,
      [isAr ? 'الإيراد' : 'Revenue']: Number(tr.revenue || 0).toFixed(3),
      [isAr ? 'التكلفة' : 'Cost']: Number(tr.cost || 0).toFixed(3),
      [isAr ? 'الربح' : 'Profit']: Number(tr.profit || 0).toFixed(3),
      [isAr ? 'الاشتراكات' : 'Subscriptions']: tr.subs,
    }));
    exportToExcel([...rows, {}, ...trendRows], `finance_${monthYear}.xlsx`, isAr ? 'المالية' : 'Finance');
  };

  if (loading || !summary) {
    return <div className="loading"><div className="spinner" />{t('loading')}</div>;
  }

  const profitClr = summary.profit > 0 ? '#0d9488' : '#dc2626';
  const maxTrend = Math.max(...trend.map(tr => Math.max(tr.revenue, tr.cost)), 1);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>💹 {t('financeDashboard')}</h2>
          <div className="breadcrumb">
            {isAr ? 'المالية والعمليات / لوحة المالية' : 'Finance & Ops / Finance Dashboard'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="month" className="form-control" value={monthYear}
            onChange={e => setMonthYear(e.target.value)} style={{ maxWidth: 200 }} />
          <button className="btn btn-ghost" onClick={handleExport}>📤 Excel</button>
          <button className="btn btn-ghost" onClick={() => exportToPDF('fin-print', isAr ? 'تقرير المالية' : 'Finance Report')}>📄 PDF</button>
          <button className="btn btn-ghost" onClick={() => printArea('fin-print', isAr ? 'تقرير المالية' : 'Finance Report')}>🖨️ {isAr ? 'طباعة' : 'Print'}</button>
        </div>
      </div>

      <div className="page-body" id="fin-print">
        <div className="alert alert-info fade-in" style={{ marginBottom: 16, fontSize: '.85rem' }}>
          ℹ️ <strong>{isAr ? 'أساس الحساب (Cash Basis):' : 'Cash Basis:'}</strong>{' '}
          {isAr
            ? 'الإيرادات بتُحتسب من الدفعات المستلمة فى الشهر. الأرقام تقديرية — للدقة افتح '
            : 'Revenue is calculated from payments received in the month. Figures are estimates — for accuracy open '}
          <strong
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => navigate('/profit-loss')}
          >
            {isAr ? 'قائمة الدخل (P&L)' : 'Income Statement (P&L)'}
          </strong>.
        </div>

        {/* Row 1: Core KPIs */}
        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card" style={clickCard}
            onClick={() => navigate(`/finance/breakdown?type=revenue&month=${monthYear}`)}>
            <div className="stat-label">{t('revenue')} 📋 ›</div>
            <div className="stat-value" style={{ color: '#0d9488' }}>{kwd(summary.revenue)}</div>
          </div>
          <div className="stat-card" style={clickCard}
            onClick={() => navigate(`/finance/breakdown?type=purchases&month=${monthYear}`)}>
            <div className="stat-label">{t('purchaseTotal')} 🛒 ›</div>
            <div className="stat-value" style={{ color: '#f59e0b' }}>{kwd(summary.purchaseTotal)}</div>
          </div>
          <div className="stat-card" style={clickCard}
            onClick={() => navigate(`/finance/breakdown?type=expenses&month=${monthYear}`)}>
            <div className="stat-label">{t('expenseTotal')} 💸 ›</div>
            <div className="stat-value" style={{ color: '#dc2626' }}>{kwd(summary.expenseTotal)}</div>
          </div>
          <div className="stat-card" style={clickCard} onClick={() => navigate('/profit-loss')}>
            <div className="stat-label">{t('estimatedProfit')} ⓘ ›</div>
            <div className="stat-value" style={{ color: profitClr }}>{kwd(summary.profit)}</div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>
              {isAr ? 'تقديري — للدقة افتح P&L' : 'Estimated — open P&L for accuracy'}
            </div>
          </div>
        </div>

        {/* Row 2: Secondary KPIs */}
        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card" style={clickCard}
            onClick={() => navigate('/finance/breakdown?type=inventory')}>
            <div className="stat-label">{t('inventoryValue')} 📦 ›</div>
            <div className="stat-value">{kwd(summary.inventoryValue)}</div>
          </div>
          <div className="stat-card" style={clickCard}
            onClick={() => navigate('/finance/breakdown?type=active-subs')}>
            <div className="stat-label">{t('activeSubs')} 👥 ›</div>
            <div className="stat-value">{summary.activeSubs}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('revenuePerSub')}</div>
            <div className="stat-value">{kwd(summary.revenuePerSub)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('breakEvenSubs')}</div>
            <div className="stat-value">{summary.breakEvenSubs || '—'}</div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4 }}>
              {t('subsToBreakEven')}
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h3>{t('expenseBreakdown')}</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{t('fixed')}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#3b82f6' }}>
                  {kwd(summary.fixedExpenses)}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{t('variable')}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b' }}>
                  {kwd(summary.variableExpenses)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Trend Chart */}
        <div className="card">
          <div className="card-header"><h3>{t('monthlyTrend')}</h3></div>
          <div className="card-body">
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${trend.length}, 1fr)`,
              gap: 8, alignItems: 'end', height: 180, marginBottom: 16,
            }}>
              {trend.map((tr, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'end', justifyContent: 'center', height: 140 }}>
                    <div
                      title={`${t('revenue')}: ${Number(tr.revenue || 0).toFixed(3)}`}
                      style={{ width: 14, height: `${(tr.revenue / maxTrend) * 100}%`, background: '#0d9488', borderRadius: '2px 2px 0 0' }}
                    />
                    <div
                      title={`${t('cost')}: ${Number(tr.cost || 0).toFixed(3)}`}
                      style={{ width: 14, height: `${(tr.cost / maxTrend) * 100}%`, background: '#dc2626', borderRadius: '2px 2px 0 0' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 6 }}>{tr.label}</div>
                </div>
              ))}
            </div>
            <table>
              <thead><tr>
                <th>{t('month')}</th>
                <th>{t('revenue')}</th>
                <th>{t('cost')}</th>
                <th>{t('profit')}</th>
                <th>{t('activeSubs')}</th>
              </tr></thead>
              <tbody>
                {trend.map((tr, i) => (
                  <tr key={i}>
                    <td>{tr.label}</td>
                    <td style={{ color: '#0d9488' }}>{Number(tr.revenue || 0).toFixed(3)}</td>
                    <td style={{ color: '#dc2626' }}>{Number(tr.cost || 0).toFixed(3)}</td>
                    <td style={{ color: tr.profit > 0 ? '#0d9488' : '#dc2626', fontWeight: 700 }}>
                      {Number(tr.profit || 0).toFixed(3)}
                    </td>
                    <td>{tr.subs}</td>
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
