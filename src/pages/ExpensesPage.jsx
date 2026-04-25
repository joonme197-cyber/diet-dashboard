import { useState, useEffect, useRef } from 'react';
import {
  getExpenses, addExpense, updateExpense, deleteExpense,
  bulkAddExpenses, sumExpenses, groupExpensesByCategory,
  EXPENSE_CATEGORIES,
} from '../firebase/expenseService';
import { exportToExcel, importFromExcel, downloadSampleFile, printArea } from '../utils/excelUtils';

const EMPTY = { type: 'fixed', category: 'rent', amount: 0, date: new Date().toISOString().slice(0,10), description: '' };

export default function ExpensesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0,7));
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setItems(await getExpenses(monthYear));
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

  const handleSave = async () => {
    if (!form.amount) return;
    setSaving(true);
    if (editItem) await updateExpense(editItem.id, form);
    else await addExpense(form);
    setSaving(false); setShowForm(false);
    setMsg(editItem ? 'تم التعديل' : 'تمت الإضافة');
    load();
    setTimeout(() => setMsg(''), 2000);
  };

  const handleDelete = async (id) => {
    if (window.confirm('حذف المصروف؟')) { await deleteExpense(id); load(); }
  };

  const handleExport = () => {
    const rows = items.map(e => ({
      'التاريخ': e.date, 'النوع': e.type === 'fixed' ? 'ثابت' : 'متغير',
      'الفئة': e.category, 'المبلغ': Number(e.amount).toFixed(3), 'الوصف': e.description || '',
    }));
    exportToExcel(rows, `expenses_${monthYear}.xlsx`, 'المصروفات');
  };

  const handleTemplate = () => {
    downloadSampleFile(
      ['التاريخ', 'النوع', 'الفئة', 'المبلغ', 'الوصف'],
      { 'التاريخ': new Date().toISOString().slice(0,10), 'النوع': 'ثابت', 'الفئة': 'rent', 'المبلغ': 500, 'الوصف': 'إيجار شهري' },
      'expenses_template.xlsx'
    );
  };

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const count = await bulkAddExpenses(rows);
      setMsg(`تم استيراد ${count} مصروف`);
      load();
    } catch (err) { setMsg('فشل الاستيراد: ' + err.message); }
    e.target.value = '';
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>💸 المصروفات</h2><div className="breadcrumb">المالية والعمليات / المصروفات</div></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>📥 استيراد</button>
          <button className="btn btn-ghost" onClick={handleExport}>📤 تصدير</button>
          <button className="btn btn-ghost" onClick={handleTemplate}>📋 قالب</button>
          <button className="btn btn-ghost" onClick={() => printArea('exp-print', 'تقرير المصروفات')}>🖨️ طباعة</button>
          <button className="btn btn-primary" onClick={openAdd}>+ مصروف</button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div style={{ marginBottom:16 }}>
          <input type="month" className="form-control" value={monthYear}
            onChange={e => setMonthYear(e.target.value)} style={{ maxWidth:200 }} />
        </div>

        <div className="stats-grid" style={{ marginBottom:16 }}>
          <div className="stat-card"><div className="stat-label">إجمالي المصروفات</div><div className="stat-value">{total.toFixed(3)} د.ك</div></div>
          <div className="stat-card"><div className="stat-label">ثابتة</div><div className="stat-value" style={{ color:'#3b82f6' }}>{fixedTotal.toFixed(3)} د.ك</div></div>
          <div className="stat-card"><div className="stat-label">متغيرة</div><div className="stat-value" style={{ color:'#f59e0b' }}>{varTotal.toFixed(3)} د.ك</div></div>
        </div>

        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-header"><h3>توزيع حسب الفئة</h3></div>
          <div className="card-body">
            {Object.keys(byCategory).length === 0 ? <p style={{ color:'#94a3b8' }}>لا بيانات</p> :
              Object.entries(byCategory).map(([key, val]) => {
                const all = [...EXPENSE_CATEGORIES.fixed, ...EXPENSE_CATEGORIES.variable];
                const lbl = all.find(c => c.key === key)?.label || key;
                const pct = total > 0 ? (val / total * 100).toFixed(1) : 0;
                return (
                  <div key={key} style={{ marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.85rem' }}>
                      <span>{lbl}</span><span><strong>{val.toFixed(3)} د.ك</strong> ({pct}%)</span>
                    </div>
                    <div style={{ height:8, background:'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background:'#0d9488' }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>قائمة المصروفات</h3><span className="badge badge-teal">{items.length}</span></div>
          <div className="table-wrapper" id="exp-print">
            {loading ? <div className="loading"><div className="spinner" />جاري التحميل...</div>
            : items.length === 0 ? <div className="empty-state"><div className="empty-icon">💸</div><h3>لا توجد مصروفات</h3></div>
            : (
              <table>
                <thead><tr>
                  <th>#</th><th>التاريخ</th><th>النوع</th><th>الفئة</th>
                  <th>المبلغ</th><th>الوصف</th><th>الإجراءات</th>
                </tr></thead>
                <tbody>
                  {items.map((e, i) => {
                    const all = [...EXPENSE_CATEGORIES.fixed, ...EXPENSE_CATEGORIES.variable];
                    const lbl = all.find(c => c.key === e.category)?.label || e.category;
                    return (
                      <tr key={e.id}>
                        <td>{i+1}</td><td>{e.date}</td>
                        <td>{e.type === 'fixed' ? 'ثابت' : 'متغير'}</td>
                        <td>{lbl}</td>
                        <td><strong>{Number(e.amount).toFixed(3)} د.ك</strong></td>
                        <td>{e.description}</td>
                        <td><div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(e)}>تعديل</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id)}>حذف</button>
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'تعديل مصروف' : 'مصروف جديد'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-2">
                <div className="form-group"><label className="form-label">النوع</label>
                  <select className="form-control" value={form.type} onChange={e => setForm(p => ({...p, type:e.target.value, category: catList(e.target.value)[0]?.key }))}>
                    <option value="fixed">ثابت</option><option value="variable">متغير</option>
                  </select></div>
                <div className="form-group"><label className="form-label">الفئة</label>
                  <select className="form-control" value={form.category} onChange={e => setForm(p => ({...p, category:e.target.value}))}>
                    {catList(form.type).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">المبلغ (د.ك) *</label>
                  <input type="number" step="0.001" className="form-control" value={form.amount}
                    onChange={e => setForm(p => ({...p, amount:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">التاريخ</label>
                  <input type="date" className="form-control" value={form.date}
                    onChange={e => setForm(p => ({...p, date:e.target.value}))} /></div>
                <div className="form-group" style={{ gridColumn:'1 / -1' }}><label className="form-label">الوصف</label>
                  <input className="form-control" value={form.description}
                    onChange={e => setForm(p => ({...p, description:e.target.value}))} /></div>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
                {saving ? 'جاري الحفظ...' : editItem ? 'حفظ' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
