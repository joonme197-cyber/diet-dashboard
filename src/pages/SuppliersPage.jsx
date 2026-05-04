import { useState, useEffect, useRef } from 'react';
import {
  getSuppliers, addSupplier, updateSupplier, deleteSupplier,
  bulkAddSuppliers, SUPPLIER_CATEGORIES,
} from '../firebase/supplierService';
import { exportToExcel, importFromExcel, downloadSampleFile, printArea, exportToPDF } from '../utils/excelUtils';

const EMPTY = { name:'', phone:'', email:'', category:'general', address:'', notes:'' };

export default function SuppliersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const fileRef = useRef(null);

  const load = async () => { setLoading(true); setItems(await getSuppliers()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()));
  const totalBalance = items.reduce((s, i) => s + (i.balance || 0), 0);

  const openAdd = () => { setEditItem(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (it) => { setEditItem(it); setForm({ ...EMPTY, ...it }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    if (editItem) await updateSupplier(editItem.id, form);
    else await addSupplier(form);
    setSaving(false); setShowForm(false);
    setMsg(editItem ? 'تم التعديل' : 'تمت الإضافة');
    load();
    setTimeout(() => setMsg(''), 2000);
  };

  const handleDelete = async (id) => {
    if (window.confirm('حذف هذا المورد؟')) { await deleteSupplier(id); load(); }
  };

  const handleExport = () => {
    const rows = items.map(s => ({
      'اسم المورد': s.name, 'الهاتف': s.phone, 'البريد': s.email,
      'الفئة': s.category, 'العنوان': s.address,
      'الرصيد المستحق': (s.balance || 0).toFixed(3), 'ملاحظات': s.notes || '',
    }));
    exportToExcel(rows, `suppliers_${new Date().toISOString().slice(0,10)}.xlsx`, 'الموردون');
  };

  const handleTemplate = () => {
    downloadSampleFile(
      ['اسم المورد', 'الهاتف', 'البريد', 'الفئة', 'العنوان', 'ملاحظات'],
      { 'اسم المورد': 'مورد اللحوم الطازجة', 'الهاتف': '99887766', 'البريد': 'meat@example.com', 'الفئة': 'meat', 'العنوان': 'الكويت', 'ملاحظات': '' },
      'suppliers_template.xlsx'
    );
  };

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const count = await bulkAddSuppliers(rows);
      setMsg(`تم استيراد ${count} مورد`);
      load();
    } catch (err) { setMsg('فشل الاستيراد: ' + err.message); }
    e.target.value = '';
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>🏢 الموردون</h2><div className="breadcrumb">المالية والعمليات / الموردون</div></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>📥 استيراد</button>
          <button className="btn btn-ghost" onClick={handleExport}>📤 تصدير</button>
          <button className="btn btn-ghost" onClick={handleTemplate}>📋 قالب</button>
          <button className="btn btn-ghost" onClick={() => exportToPDF('sup-print', 'تقرير الموردين')}>📄 PDF</button>
          <button className="btn btn-ghost" onClick={() => printArea('sup-print', 'تقرير الموردين')}>🖨️ طباعة</button>
          <button className="btn btn-primary" onClick={openAdd}>+ إضافة مورد</button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div className="stats-grid" style={{ marginBottom:16 }}>
          <div className="stat-card"><div className="stat-label">إجمالي الموردين</div><div className="stat-value">{items.length}</div></div>
          <div className="stat-card"><div className="stat-label">إجمالي المستحقات</div><div className="stat-value" style={{ color:'#dc2626' }}>{totalBalance.toFixed(3)} د.ك</div></div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>قائمة الموردين</h3>
            <input className="form-control" placeholder="🔍 بحث..." value={search} onChange={e=>setSearch(e.target.value)} style={{ maxWidth:250 }} />
          </div>
          <div className="table-wrapper" id="sup-print">
            {loading ? <div className="loading"><div className="spinner" />جاري التحميل...</div>
            : filtered.length === 0 ? <div className="empty-state"><div className="empty-icon">🏢</div><h3>لا يوجد موردون</h3></div>
            : (
              <table>
                <thead><tr>
                  <th>#</th><th>الاسم</th><th>الفئة</th><th>الهاتف</th>
                  <th>الرصيد المستحق</th><th>الإجراءات</th>
                </tr></thead>
                <tbody>
                  {filtered.map((s, i) => {
                    const cat = SUPPLIER_CATEGORIES.find(c => c.key === s.category);
                    return (
                      <tr key={s.id}>
                        <td>{i+1}</td>
                        <td><strong>{s.name}</strong></td>
                        <td>{cat?.label || s.category}</td>
                        <td>{s.phone}</td>
                        <td style={{ color: (s.balance||0) > 0 ? '#dc2626' : '#0d9488', fontWeight:700 }}>
                          {(s.balance || 0).toFixed(3)} د.ك
                        </td>
                        <td><div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>تعديل</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>حذف</button>
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
              <h3>{editItem ? 'تعديل مورد' : 'إضافة مورد'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-2">
                <div className="form-group"><label className="form-label">الاسم *</label>
                  <input className="form-control" value={form.name} onChange={e => setForm(p => ({...p, name:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">الفئة</label>
                  <select className="form-control" value={form.category} onChange={e => setForm(p => ({...p, category:e.target.value}))}>
                    {SUPPLIER_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">الهاتف</label>
                  <input className="form-control" value={form.phone} onChange={e => setForm(p => ({...p, phone:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">البريد</label>
                  <input className="form-control" value={form.email} onChange={e => setForm(p => ({...p, email:e.target.value}))} /></div>
                <div className="form-group" style={{ gridColumn:'1 / -1' }}><label className="form-label">العنوان</label>
                  <input className="form-control" value={form.address} onChange={e => setForm(p => ({...p, address:e.target.value}))} /></div>
                <div className="form-group" style={{ gridColumn:'1 / -1' }}><label className="form-label">ملاحظات</label>
                  <input className="form-control" value={form.notes} onChange={e => setForm(p => ({...p, notes:e.target.value}))} /></div>
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
