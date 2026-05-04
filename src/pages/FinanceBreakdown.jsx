import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getAllSubscriptions } from '../firebase/subscriptionService';
import { getPurchases } from '../firebase/purchaseService';
import { getExpenses } from '../firebase/expenseService';
import { getInventory } from '../firebase/inventoryService';
import { getInventoryCategories, getExpenseCategories, getCatLabel } from '../firebase/categoryService';
import { getSuppliers } from '../firebase/supplierService';
import { exportToExcel, printArea, exportToPDF } from '../utils/excelUtils';
import { useLang } from '../LanguageContext';

export default function FinanceBreakdown() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, isAr, lang } = useLang();

  const type = params.get('type') || 'revenue';
  const monthYear = params.get('month') || new Date().toISOString().slice(0, 7);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const TITLES = {
    revenue:      { icon: '💰', titleAr: 'تفاصيل الإيرادات',       titleEn: 'Revenue Details',        descAr: 'الاشتراكات والدفعات المحصّلة فى الشهر', descEn: 'Subscriptions & payments collected in month' },
    'active-subs':{ icon: '👥', titleAr: 'الاشتراكات النشطة',       titleEn: 'Active Subscriptions',   descAr: 'كل الاشتراكات بحالة نشطة',             descEn: 'All active subscriptions' },
    purchases:    { icon: '🛒', titleAr: 'تفاصيل المشتريات',        titleEn: 'Purchases Details',      descAr: 'فواتير الشراء فى الشهر',               descEn: 'Purchase invoices in the month' },
    expenses:     { icon: '💸', titleAr: 'تفاصيل المصروفات',        titleEn: 'Expenses Details',       descAr: 'كل المصروفات الثابتة والمتغيرة',        descEn: 'All fixed & variable expenses' },
    inventory:    { icon: '📦', titleAr: 'تفاصيل قيمة المخزون',     titleEn: 'Inventory Value Details',descAr: 'كل أصناف المخزون وقيمتها',             descEn: 'All inventory items & values' },
  };

  useEffect(() => { load(); }, [type, monthYear, lang]);

  const kwd = (n) => `${Number(n || 0).toFixed(3)} ${isAr ? 'د.ك' : 'KWD'}`;

  const load = async () => {
    setLoading(true);
    const [yr, mo] = monthYear.split('-').map(Number);
    let result = []; let sum = 0;

    if (type === 'revenue') {
      const subs = await getAllSubscriptions();
      const filtered = subs.filter(s => {
        const d = s.createdAt?.toDate?.() || new Date(s.createdAt);
        return d.getFullYear() === yr && d.getMonth() + 1 === mo;
      });
      result = filtered.map(s => {
        const paid = (s.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        sum += paid;
        const statusLabel = s.status === 'active'
          ? (isAr ? 'نشط' : 'Active')
          : s.status === 'paused'
            ? (isAr ? 'موقوف' : 'Paused')
            : (isAr ? 'منتهى' : 'Expired');
        return {
          id: s.id,
          [isAr ? 'العميل' : 'Client']: s.clientName || s.customerName || '-',
          [isAr ? 'الباقة' : 'Package']: s.packageName || '-',
          [isAr ? 'الحالة' : 'Status']: statusLabel,
          [isAr ? 'تاريخ البدء' : 'Start Date']: s.startDate || (s.createdAt?.toDate?.()?.toLocaleDateString() || ''),
          [isAr ? 'الدفعات' : 'Payments']: (s.payments || []).length,
          [isAr ? 'إجمالي المدفوع' : 'Total Paid']: kwd(paid),
          _amount: paid,
        };
      });
    }
    else if (type === 'active-subs') {
      const subs = await getAllSubscriptions();
      const filtered = subs.filter(s => s.status === 'active');
      result = filtered.map(s => {
        const paid = (s.payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        sum += paid;
        return {
          id: s.id,
          [isAr ? 'العميل' : 'Client']: s.clientName || s.customerName || '-',
          [isAr ? 'الباقة' : 'Package']: s.packageName || '-',
          [isAr ? 'تاريخ البدء' : 'Start Date']: s.startDate || '',
          [isAr ? 'تاريخ النهاية' : 'End Date']: s.endDate || '',
          [isAr ? 'إجمالي المدفوع' : 'Total Paid']: kwd(paid),
          _amount: paid,
        };
      });
    }
    else if (type === 'purchases') {
      const [purs, sups] = await Promise.all([getPurchases(), getSuppliers()]);
      const filtered = purs.filter(p => {
        const d = p.createdAt?.toDate?.() || new Date(p.createdAt || p.date);
        return d.getFullYear() === yr && d.getMonth() + 1 === mo;
      });
      result = filtered.map(p => {
        const sup = sups.find(s => s.id === p.supplierId);
        const amt = Number(p.totalAmount) || 0;
        sum += amt;
        const statusLabel = p.paymentStatus === 'paid'
          ? (isAr ? 'مدفوع' : 'Paid')
          : p.paymentStatus === 'partial'
            ? (isAr ? 'جزئي' : 'Partial')
            : (isAr ? 'معلّق' : 'Pending');
        return {
          id: p.id,
          [isAr ? 'التاريخ' : 'Date']: p.date,
          [isAr ? 'المورد' : 'Supplier']: sup?.name || p.supplierName || '-',
          [isAr ? 'البنود' : 'Items']: p.items?.length || 0,
          [isAr ? 'الإجمالي' : 'Total']: kwd(amt),
          [isAr ? 'المدفوع' : 'Paid']: kwd(Number(p.paidAmount) || 0),
          [isAr ? 'المتبقي' : 'Remaining']: kwd(amt - (Number(p.paidAmount) || 0)),
          [isAr ? 'الحالة' : 'Status']: statusLabel,
          _amount: amt,
        };
      });
    }
    else if (type === 'expenses') {
      const [exps, expCats] = await Promise.all([getExpenses(monthYear), getExpenseCategories()]);
      const allCats = [...expCats.fixed, ...expCats.variable];
      result = exps.map(e => {
        const amt = Number(e.amount) || 0;
        sum += amt;
        const cat = allCats.find(c => c.key === e.category);
        return {
          id: e.id,
          [isAr ? 'التاريخ' : 'Date']: e.date,
          [isAr ? 'النوع' : 'Type']: e.type === 'fixed' ? (isAr ? 'ثابت' : 'Fixed') : (isAr ? 'متغير' : 'Variable'),
          [isAr ? 'كود الفئة' : 'Cat. Code']: cat?.code || '',
          [isAr ? 'الفئة' : 'Category']: cat ? getCatLabel(cat, lang) : e.category,
          [isAr ? 'المبلغ' : 'Amount']: kwd(amt),
          [isAr ? 'الوصف' : 'Description']: e.description || '',
          _amount: amt,
        };
      });
    }
    else if (type === 'inventory') {
      const [inv, invCats] = await Promise.all([getInventory(), getInventoryCategories()]);
      result = inv.map(i => {
        const val = (Number(i.currentStock) || 0) * (Number(i.costPerUnit) || 0);
        sum += val;
        const cat = invCats.find(c => c.key === i.category);
        return {
          id: i.id,
          [isAr ? 'الكود' : 'Code']: i.code || '',
          [isAr ? 'الاسم بالعربي' : 'Arabic Name']: i.nameAr || i.name || '',
          [isAr ? 'الاسم بالإنجليزي' : 'English Name']: i.nameEn || '',
          [isAr ? 'التصنيف' : 'Category']: cat
            ? `${cat.code ? `[${cat.code}] ` : ''}${getCatLabel(cat, lang)}`
            : i.category,
          [isAr ? 'المخزون' : 'Stock']: `${i.currentStock} ${i.unit || ''}`,
          [isAr ? 'تكلفة الوحدة' : 'Cost/Unit']: kwd(Number(i.costPerUnit) || 0),
          [isAr ? 'القيمة الإجمالية' : 'Total Value']: kwd(val),
          _amount: val,
        };
      });
    }

    setRows(result); setTotal(sum); setLoading(false);
  };

  const meta = TITLES[type] || { icon: '📊', titleAr: 'تفاصيل', titleEn: 'Details', descAr: '', descEn: '' };
  const metaTitle = isAr ? meta.titleAr : meta.titleEn;
  const metaDesc = isAr ? meta.descAr : meta.descEn;
  const headers = rows[0] ? Object.keys(rows[0]).filter(k => !k.startsWith('_') && k !== 'id') : [];

  const handleExport = () => {
    const clean = rows.map(({ id, _amount, ...r }) => r);
    exportToExcel(clean, `${type}_${monthYear}.xlsx`, metaTitle);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{meta.icon} {metaTitle}</h2>
          <div className="breadcrumb">
            <span style={{ cursor: 'pointer', color: '#0d9488' }} onClick={() => navigate('/finance')}>
              ← {t('backToFinance')}
            </span>
            {' / '} {metaTitle}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(type === 'revenue' || type === 'purchases' || type === 'expenses') && (
            <input type="month" className="form-control" value={monthYear}
              onChange={e => navigate(`/finance/breakdown?type=${type}&month=${e.target.value}`)}
              style={{ maxWidth: 180 }} />
          )}
          <button className="btn btn-ghost" onClick={handleExport}>📤 Excel</button>
          <button className="btn btn-ghost" onClick={() => exportToPDF('bd-print', metaTitle)}>📄 PDF</button>
          <button className="btn btn-ghost" onClick={() => printArea('bd-print', metaTitle)}>🖨️ {isAr ? 'طباعة' : 'Print'}</button>
        </div>
      </div>

      <div className="page-body">
        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-label">{t('itemsCount')}</div>
            <div className="stat-value">{rows.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('total')}</div>
            <div className="stat-value" style={{ color: '#0d9488' }}>{total.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</div>
          </div>
          {(type === 'revenue' || type === 'purchases' || type === 'expenses') && (
            <div className="stat-card">
              <div className="stat-label">{t('month')}</div>
              <div className="stat-value">{monthYear}</div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>{metaDesc}</h3>
            <span className="badge badge-teal">{rows.length}</span>
          </div>
          <div className="table-wrapper" id="bd-print">
            {loading ? (
              <div className="loading"><div className="spinner" />{t('loading')}</div>
            ) : rows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">{meta.icon}</div>
                <h3>{t('noData')}</h3>
              </div>
            ) : (
              <table>
                <thead><tr>
                  <th>#</th>
                  {headers.map(h => <th key={h}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id || i}>
                      <td>{i + 1}</td>
                      {headers.map(h => <td key={h}>{r[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f0fdfa', fontWeight: 700 }}>
                    <td colSpan={headers.length}>{t('total')}</td>
                    <td style={{ color: '#0d9488' }}>{total.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
