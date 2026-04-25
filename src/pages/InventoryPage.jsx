import { useState, useEffect, useRef } from 'react';
import {
  getInventory, addIngredient, updateIngredient, deleteIngredient,
  bulkAddIngredients, getLowStockItems, calcInventoryValue,
  INGREDIENT_CATEGORIES, UNITS,
} from '../firebase/inventoryService';
import { exportToExcel, importFromExcel, downloadSampleFile, printArea } from '../utils/excelUtils';

const EMPTY = { name: '', category: 'other', unit: 'كيلو', currentStock: 0, minStock: 0, costPerUnit: 0, notes: '' };

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setItems(await getInventory());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(i =>
    (!search || i.name?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterCat || i.category === filterCat)
  );
  const lowStock = getLowStockItems(items);
  const totalValue = calcInventoryValue(items);

  const openAdd = () => { setEditItem(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (it) => { setEditItem(it); setForm({ ...EMPTY, ...it }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    if (editItem) await updateIngredient(editItem.id, form);
    else await addIngredient(form);
    setSaving(false); setShowForm(false);
    setMsg(editItem ? 'تم التعديل' : 'تمت الإضافة');
    load();
    setTimeout(() => setMsg(''), 2000);
  };

  const handleDelete = async (id) => {
    if (window.confirm('حذف هذا المكون؟')) { await deleteIngredient(id); load(); }
  };

  const handleExport = () => {
    const rows = items.map(i => ({
      'اسم المكون': i.name, 'التصنيف': i.category, 'الوحدة': i.unit,
      'المخزون الحالي': i.currentStock, 'الحد الأدنى': i.minStock,
      'تكلفة الوحدة': i.costPerUnit,
      'القيمة الإجمالية': (i.currentStock * i.costPerUnit).toFixed(3),
      'ملاحظات': i.notes || '',
    }));
    exportToExcel(rows, `inventory_${new Date().toISOString().slice(0,10)}.xlsx`, 'المخزون');
  };

  const handleTemplate = () => {
    downloadSampleFile(
      ['اسم المكون', 'التصنيف', 'الوحدة', 'المخزون الحالي', 'الحد الأدنى', 'تكلفة الوحدة', 'ملاحظات'],
      { 'اسم المكون': 'دجاج صدور', 'التصنيف': 'meat', 'الوحدة': 'كيلو', 'المخزون الحالي': 50, 'الحد الأدنى': 10, 'تكلفة الوحدة': 1.750, 'ملاحظات': '' },
      'inventory_template.xlsx'
    );
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const count = await bulkAddIngredients(rows);
      setMsg(`تم استيراد ${count} مكون`);
      load();
    } catch (err) { setMsg('فشل الاستيراد: ' + err.message); }
    e.target.value = '';
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>📦 المخزون</h2><div className="breadcrumb">المالية والعمليات / المخزون</div></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>📥 استيراد Excel</button>
          <button className="btn btn-ghost" onClick={handleExport}>📤 تصدير Excel</button>
          <button className="btn btn-ghost" onClick={handleTemplate}>📋 قالب فارغ</button>
          <button className="btn btn-ghost" onClick={() => printArea('inventory-print', 'تقرير المخزون')}>🖨️ طباعة</button>
          <button className="btn btn-primary" onClick={openAdd}>+ إضافة مكون</button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div className="stats-grid" style={{ marginBottom:16 }}>
          <div className="stat-card"><div className="stat-label">إجمالي المكونات</div><div className="stat-value">{items.length}</div></div>
          <div className="stat-card"><div className="stat-label">قيمة المخزون</div><div className="stat-value">{totalValue.toFixed(3)} د.ك</div></div>
          <div className="stat-card"><div className="stat-label">تنبيهات نقص</div><div className="stat-value" style={{ color: lowStock.length ? '#dc2626' : '#0d9488' }}>{lowStock.length}</div></div>
        </div>

        <div className="card">
          <div className="card-header" style={{ flexWrap:'wrap', gap:10 }}>
            <h3>قائمة المخزون</h3>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <input className="form-control" placeholder="🔍 بحث..." value={search} onChange={e=>setSearch(e.target.value)} style={{ maxWidth:200 }} />
              <select className="form-control" value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ maxWidth:180 }}>
                <option value="">كل التصنيفات</option>
                {INGREDIENT_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="table-wrapper" id="inventory-print">
            {loading ? <div className="loading"><div className="spinner" />جاري التحميل...</div>
            : filtered.length === 0 ? <div className="empty-state"><div className="empty-icon">📦</div><h3>لا توجد مكونات</h3></div>
            : (
              <table>
                <thead><tr>
                  <th>#</th><th>الاسم</th><th>التصنيف</th><th>الوحدة</th>
                  <th>المخزون</th><th>الحد الأدنى</th><th>تكلفة/وحدة</th><th>القيمة</th><th>الإجراءات</th>
                </tr></thead>
                <tbody>
                  {filtered.map((it, i) => {
                    const low = it.currentStock <= it.minStock;
                    const cat = INGREDIENT_CATEGORIES.find(c => c.key === it.category);
                    return (
                      <tr key={it.id} style={low ? { background:'#fef2f2' } : {}}>
                        <td>{i+1}</td>
                        <td><strong>{it.name}</strong>{low && <span style={{ color:'#dc2626', marginRight:6 }}>⚠️</span>}</td>
                        <td>{cat?.label || it.category}</td>
                        <td>{it.unit}</td>
                        <td><strong>{it.currentStock}</strong></td>
                        <td>{it.minStock}</td>
                        <td>{Number(it.costPerUnit).toFixed(3)} د.ك</td>
                        <td>{(it.currentStock * it.costPerUnit).toFixed(3)} د.ك</td>
                        <td><div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(it)}>تعديل</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(it.id)}>حذف</button>
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
              <h3>{editItem ? 'تعديل مكون' : 'إضافة مكون'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-2">
                <div className="form-group"><label className="form-label">الاسم *</label>
                  <input className="form-control" value={form.name} onChange={e => setForm(p => ({...p, name:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">التصنيف</label>
                  <select className="form-control" value={form.category} onChange={e => setForm(p => ({...p, category:e.target.value}))}>
                    {INGREDIENT_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">الوحدة</label>
                  <select className="form-control" value={form.unit} onChange={e => setForm(p => ({...p, unit:e.target.value}))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">المخزون الحالي</label>
                  <input type="number" step="0.001" className="form-control" value={form.currentStock} onChange={e => setForm(p => ({...p, currentStock:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">الحد الأدنى</label>
                  <input type="number" step="0.001" className="form-control" value={form.minStock} onChange={e => setForm(p => ({...p, minStock:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">تكلفة الوحدة (د.ك)</label>
                  <input type="number" step="0.001" className="form-control" value={form.costPerUnit} onChange={e => setForm(p => ({...p, costPerUnit:e.target.value}))} /></div>
                <div className="form-group" style={{ gridColumn:'1 / -1' }}><label className="form-label">ملاحظات</label>
                  <input className="form-control" value={form.notes} onChange={e => setForm(p => ({...p, notes:e.target.value}))} /></div>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
                {saving ? 'جاري الحفظ...' : editItem ? 'حفظ التعديلات' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
