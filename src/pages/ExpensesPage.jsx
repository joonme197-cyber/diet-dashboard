import { useState, useEffect, useRef } from 'react';
import {
  getExpenses, addExpense, updateExpense, deleteExpense,
  bulkAddExpenses, sumExpenses, groupExpensesByCategory,
} from '../firebase/expenseService';
import { getExpenseCategories, setExpenseCategories, getCatLabel } from '../firebase/categoryService';
import { exportToExcel, importFromExcel, downloadSampleFile, printArea, exportToPDF } from '../utils/excelUtils';
import CategoryManagerModal from '../components/CategoryManagerModal';
import { useLang } from '../LanguageContext';

const EMPTY = { type: 'fixed', category: 'rent', amount: 0, date: new Date().toISOString().slice(0, 10), description: '' };

export default function ExpensesPage() {
  const { t, lang, isAr } = useLang();
  const [items, setItems] = useState([]);
  const [EXPENSE_CATEGORIES, setCategories] = useState({ fixed: [], variable: [] });
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0, 7));
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const [exps, cats] = await Promise.all([getExpenses(monthYear), getExpenseCategories()]);
    setItems(exps);
    setCategories(cats);
    setLoading(false);
  };
  useEffect(() => { load(); }, [monthYear]);

  const fixed = items.filter(e => e.type === 'fixed');
  const variable = items.filter(e => e.type === 'variable');
  const fixedTotal = sumExpenses(fixed);
  const varTotal = sumExpenses(variable);
  const total = fixedTotal + varTotal;
  const byCategory = groupExpensesByCategory(items);

  const openAdd = () => { setEditItem(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (e) => { setEditItem(e); setForm({ ...EMPTY, ...e }); setShowForm(true); };

  const catList = (type) => EXPENSE_CATEGORIES[type] || [];

  const allCats = [...(EXPENSE_CATEGORIES.fixed || []), ...(EXPENSE_CATEGORIES.variable || [])];
  const catDisplayLabel = (cat) => {
    const found = allCats.find(c => c.key === cat);
    return found ? getCatLabel(found, lang) : cat;
  };

  const handleSave = async () => {
    if (!form.amount) return;
    setSaving(true);
    if (editItem) await updateExpense(editItem.id, form);
    else await addExpense(form);
    setSaving(false); setShowForm(false);
    setMsg(editItem ? (isAr ? 'تم التعديل' : 'Updated') : (isAr ? 'تمت الإضافة' : 'Added'));
    load();
    setTimeout(() => setMsg(''), 2000);
  };

  const handleDelete = async (id) => {
    if (window.confirm(isAr ? 'حذف المصروف؟' : 'Delete this expense?')) {
      await deleteExpense(id); load();
    }
  };

  const handleExport = () => {
    const rows = items.map(e => ({
      [isAr ? 'التاريخ' : 'Date']: e.date,
      [isAr ? 'النوع' : 'Type']: e.type === 'fixed' ? (isAr ? 'ثابت' : 'Fixed') : (isAr ? 'متغير' : 'Variable'),
      [isAr ? 'الفئة' : 'Category']: catDisplayLabel(e.category),
      [isAr ? 'كود الفئة' : 'Cat. Code']: allCats.find(c => c.key === e.category)?.code || '',
      [isAr ? 'المبلغ' : 'Amount']: Number(e.amount).toFixed(3),
      [isAr ? 'الوصف' : 'Description']: e.description || '',
    }));
    exportToExcel(rows, `expenses_${monthYear}.xlsx`, isAr ? 'المصروفات' : 'Expenses');
  };

  const handleTemplate = () => {
    downloadSampleFile(
      ['التاريخ', 'النوع', 'الفئة', 'المبلغ', 'الوصف'],
      { 'التاريخ': new Date().toISOString().slice(0, 10), 'النوع': 'ثابت', 'الفئة': 'rent', 'المبلغ': 500, 'الوصف': 'إيجار شهري' },
      'expenses_template.xlsx'
    );
  };

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const count = await bulkAddExpenses(rows);
      setMsg(`${isAr ? 'تم استيراد' : 'Imported'} ${count} ${isAr ? 'مصروف' : 'expenses'}`);
      load();
    } catch (err) { setMsg((isAr ? 'فشل الاستيراد: ' : 'Import failed: ') + err.message); }
    e.target.value = '';
    setTimeout(() => setMsg(''), 3000);
  };

  const typeLabel = (type) => {
    if (type === 'fixed') return isAr ? 'ثابت' : 'Fixed';
    return isAr ? 'متغير' : 'Variable';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>💸 {t('expenses')}</h2>
          <div className="breadcrumb">
            {isAr ? 'المالية والعمليات / المصروفات' : 'Finance & Ops / Expenses'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>📥 {t('importExcel')}</button>
          <button className="btn btn-ghost" onClick={handleExport}>📤 {t('exportExcel')}</button>
          <button className="btn btn-ghost" onClick={handleTemplate}>📋 {t('blankTemplate')}</button>
          <button className="btn btn-ghost" onClick={() => exportToPDF('exp-print', isAr ? 'تقرير المصروفات' : 'Expenses Report')}>📄 PDF</button>
          <button className="btn btn-ghost" onClick={() => printArea('exp-print', isAr ? 'تقرير المصروفات' : 'Expenses Report')}>🖨️ {isAr ? 'طباعة' : 'Print'}</button>
          <button className="btn btn-ghost" onClick={() => setShowCatMgr(true)}>🗂️ {t('manageCategories')}</button>
          <button className="btn btn-primary" onClick={openAdd}>+ {isAr ? 'مصروف' : 'Expense'}</button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div style={{ marginBottom: 16 }}>
          <input type="month" className="form-control" value={monthYear}
            onChange={e => setMonthYear(e.target.value)} style={{ maxWidth: 200 }} />
        </div>

        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-label">{t('totalExpenses')}</div>
            <div className="stat-value">{total.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{isAr ? 'ثابتة' : 'Fixed'}</div>
            <div className="stat-value" style={{ color: '#3b82f6' }}>{fixedTotal.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{isAr ? 'متغيرة' : 'Variable'}</div>
            <div className="stat-value" style={{ color: '#f59e0b' }}>{varTotal.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h3>{t('distributionByCategory')}</h3></div>
          <div className="card-body">
            {Object.keys(byCategory).length === 0 ? (
              <p style={{ color: '#94a3b8' }}>{t('noData')}</p>
            ) : Object.entries(byCategory).map(([key, val]) => {
              const found = allCats.find(c => c.key === key);
              const lbl = found ? getCatLabel(found, lang) : key;
              const codeTag = found?.code ? (
                <span style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: '.75rem', marginLeft: 4 }}>
                  [{found.code}]
                </span>
              ) : null;
              const pct = total > 0 ? (val / total * 100).toFixed(1) : 0;
              return (
                <div key={key} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>{codeTag}{lbl}</span>
                    <span><strong>{val.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</strong> ({pct}%)</span>
                  </div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#0d9488' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>{t('expensesList')}</h3>
            <span className="badge badge-teal">{items.length}</span>
          </div>
          <div className="table-wrapper" id="exp-print">
            {loading ? (
              <div className="loading"><div className="spinner" />{t('loading')}</div>
            ) : items.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">💸</div>
                <h3>{isAr ? 'لا توجد مصروفات' : 'No expenses found'}</h3>
              </div>
            ) : (
              <table>
                <thead><tr>
                  <th>#</th>
                  <th>{t('date')}</th>
                  <th>{t('type')}</th>
                  <th>{t('category')}</th>
                  <th>{t('amount')}</th>
                  <th>{t('description')}</th>
                  <th>{t('actions')}</th>
                </tr></thead>
                <tbody>
                  {items.map((e, i) => {
                    const found = allCats.find(c => c.key === e.category);
                    return (
                      <tr key={e.id}>
                        <td>{i + 1}</td>
                        <td>{e.date}</td>
                        <td>
                          <span className="badge" style={{
                            background: e.type === 'fixed' ? '#dbeafe' : '#fef3c7',
                            color: e.type === 'fixed' ? '#1e40af' : '#92400e',
                          }}>
                            {typeLabel(e.type)}
                          </span>
                        </td>
                        <td>
                          {found?.code && (
                            <span style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: '.75rem', marginLeft: 4 }}>
                              [{found.code}]
                            </span>
                          )}
                          {catDisplayLabel(e.category)}
                        </td>
                        <td><strong>{Number(e.amount).toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</strong></td>
                        <td>{e.description}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(e)}>{t('edit')}</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id)}>{t('delete')}</button>
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

      {showCatMgr && (
        <CategoryManagerModal
          title={isAr ? 'إدارة فئات المصروفات' : 'Manage Expense Categories'}
          categories={EXPENSE_CATEGORIES}
          groups={['fixed', 'variable']}
          onSave={async (newCats) => {
            await setExpenseCategories(newCats);
            setCategories(newCats);
            setShowCatMgr(false);
            setMsg(isAr ? 'تم حفظ الفئات' : 'Categories saved');
            setTimeout(() => setMsg(''), 2000);
          }}
          onClose={() => setShowCatMgr(false)}
        />
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? (isAr ? 'تعديل مصروف' : 'Edit Expense') : (isAr ? 'مصروف جديد' : 'New Expense')}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-2">
                <div className="form-group">
                  <label className="form-label">{t('type')}</label>
                  <select className="form-control" value={form.type}
                    onChange={e => setForm(p => ({ ...p, type: e.target.value, category: catList(e.target.value)[0]?.key }))}>
                    <option value="fixed">{isAr ? 'ثابت' : 'Fixed'}</option>
                    <option value="variable">{isAr ? 'متغير' : 'Variable'}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('category')}</label>
                  <select className="form-control" value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {catList(form.type).map(c => (
                      <option key={c.key} value={c.key}>
                        {c.code ? `[${c.code}] ` : ''}{getCatLabel(c, lang)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('amount')} ({isAr ? 'د.ك' : 'KWD'}) *</label>
                  <input type="number" step="0.001" className="form-control" value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('date')}</label>
                  <input type="date" className="form-control" value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">{t('description')}</label>
                  <input className="form-control" value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
                {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : editItem ? t('save') : t('add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
