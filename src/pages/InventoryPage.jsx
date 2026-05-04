import { useState, useEffect, useRef } from 'react';
import {
  getInventory, addIngredient, updateIngredient, deleteIngredient,
  bulkAddIngredients, getLowStockItems, calcInventoryValue, UNITS,
} from '../firebase/inventoryService';
import { getInventoryCategories, setInventoryCategories, getCatLabel } from '../firebase/categoryService';
import { exportToExcel, importFromExcel, downloadSampleFile, printArea, exportToPDF } from '../utils/excelUtils';
import CategoryManagerModal from '../components/CategoryManagerModal';
import { useLang } from '../LanguageContext';

const EMPTY = {
  nameAr: '', nameEn: '', code: '',
  category: 'other', unit: 'كيلو',
  currentStock: 0, minStock: 0, costPerUnit: 0, weightPerUnit: 0, notes: '',
};
const PIECE_UNITS = ['حبة', 'علبة', 'كرتون'];

export default function InventoryPage() {
  const { t, lang, isAr } = useLang();
  const [items, setItems] = useState([]);
  const [INGREDIENT_CATEGORIES, setCategories] = useState([]);
  const [showCatMgr, setShowCatMgr] = useState(false);
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
    const [inv, cats] = await Promise.all([getInventory(), getInventoryCategories()]);
    setItems(inv);
    setCategories(cats);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const displayName = (it) =>
    lang === 'en' ? (it.nameEn || it.nameAr || it.name || '') : (it.nameAr || it.name || '');

  const filtered = items.filter(i => {
    if (filterCat && i.category !== filterCat) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (i.nameAr || i.name || '').toLowerCase().includes(q) ||
      (i.nameEn || '').toLowerCase().includes(q) ||
      (i.code || '').toLowerCase().includes(q)
    );
  });
  const lowStock = getLowStockItems(items);
  const totalValue = calcInventoryValue(items);

  const openAdd = () => { setEditItem(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (it) => {
    setEditItem(it);
    setForm({
      ...EMPTY,
      ...it,
      nameAr: it.nameAr || it.name || '',
      nameEn: it.nameEn || '',
      code: it.code || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nameAr && !form.nameEn) return;
    setSaving(true);
    if (editItem) await updateIngredient(editItem.id, form);
    else await addIngredient(form);
    setSaving(false); setShowForm(false);
    setMsg(editItem ? (isAr ? 'تم التعديل' : 'Updated') : (isAr ? 'تمت الإضافة' : 'Added'));
    load();
    setTimeout(() => setMsg(''), 2000);
  };

  const handleDelete = async (id) => {
    if (window.confirm(isAr ? 'حذف هذا المكون؟' : 'Delete this ingredient?')) {
      await deleteIngredient(id); load();
    }
  };

  const handleExport = () => {
    const rows = items.map(i => ({
      [isAr ? 'الكود' : 'Code']: i.code || '',
      [isAr ? 'الاسم بالعربي' : 'Arabic Name']: i.nameAr || i.name,
      [isAr ? 'الاسم بالإنجليزي' : 'English Name']: i.nameEn || '',
      [isAr ? 'التصنيف' : 'Category']: getCatLabel(INGREDIENT_CATEGORIES.find(c => c.key === i.category), lang),
      [isAr ? 'الوحدة' : 'Unit']: i.unit,
      [isAr ? 'المخزون الحالي' : 'Current Stock']: i.currentStock,
      [isAr ? 'الحد الأدنى' : 'Min Stock']: i.minStock,
      [isAr ? 'تكلفة الوحدة' : 'Cost/Unit']: i.costPerUnit,
      [isAr ? 'القيمة الإجمالية' : 'Total Value']: (i.currentStock * i.costPerUnit).toFixed(3),
      [isAr ? 'ملاحظات' : 'Notes']: i.notes || '',
    }));
    exportToExcel(rows, `inventory_${new Date().toISOString().slice(0, 10)}.xlsx`, isAr ? 'المخزون' : 'Inventory');
  };

  const handleTemplate = () => {
    downloadSampleFile(
      ['الكود', 'الاسم بالعربي', 'الاسم بالإنجليزي', 'التصنيف', 'الوحدة', 'المخزون الحالي', 'الحد الأدنى', 'تكلفة الوحدة', 'ملاحظات'],
      { 'الكود': 'MT-001', 'الاسم بالعربي': 'دجاج صدور', 'الاسم بالإنجليزي': 'Chicken Breast', 'التصنيف': 'meat', 'الوحدة': 'كيلو', 'المخزون الحالي': 50, 'الحد الأدنى': 10, 'تكلفة الوحدة': 1.750, 'ملاحظات': '' },
      'inventory_template.xlsx'
    );
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const count = await bulkAddIngredients(rows);
      setMsg(`${isAr ? 'تم استيراد' : 'Imported'} ${count} ${isAr ? 'مكون' : 'ingredients'}`);
      load();
    } catch (err) { setMsg((isAr ? 'فشل الاستيراد: ' : 'Import failed: ') + err.message); }
    e.target.value = '';
    setTimeout(() => setMsg(''), 3000);
  };

  const catOptions = INGREDIENT_CATEGORIES.map(c => ({
    key: c.key,
    label: getCatLabel(c, lang),
    code: c.code,
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>📦 {isAr ? 'المخزون' : 'Inventory'}</h2>
          <div className="breadcrumb">
            {isAr ? 'المالية والعمليات / المخزون' : 'Finance & Ops / Inventory'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            📥 {t('importExcel')}
          </button>
          <button className="btn btn-ghost" onClick={handleExport}>📤 {t('exportExcel')}</button>
          <button className="btn btn-ghost" onClick={handleTemplate}>📋 {t('blankTemplate')}</button>
          <button className="btn btn-ghost" onClick={() => exportToPDF('inventory-print', isAr ? 'تقرير المخزون' : 'Inventory Report')}>
            📄 PDF
          </button>
          <button className="btn btn-ghost" onClick={() => printArea('inventory-print', isAr ? 'تقرير المخزون' : 'Inventory Report')}>
            🖨️ {isAr ? 'طباعة' : 'Print'}
          </button>
          <button className="btn btn-ghost" onClick={() => setShowCatMgr(true)}>
            🗂️ {t('manageCategories')}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>+ {t('addIngredient')}</button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-label">{t('totalIngredients')}</div>
            <div className="stat-value">{items.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('inventoryValue')}</div>
            <div className="stat-value">{totalValue.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t('lowStockAlerts')}</div>
            <div className="stat-value" style={{ color: lowStock.length ? '#dc2626' : '#0d9488' }}>
              {lowStock.length}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
            <h3>{t('inventoryList')}</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                className="form-control"
                placeholder={`🔍 ${t('search')}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ maxWidth: 220 }}
              />
              <select
                className="form-control"
                value={filterCat}
                onChange={e => setFilterCat(e.target.value)}
                style={{ maxWidth: 200 }}
              >
                <option value="">{t('allCategories')}</option>
                {catOptions.map(c => (
                  <option key={c.key} value={c.key}>
                    {c.code ? `[${c.code}] ` : ''}{c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="table-wrapper" id="inventory-print">
            {loading ? (
              <div className="loading"><div className="spinner" />{t('loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <h3>{isAr ? 'لا توجد مكونات' : 'No ingredients found'}</h3>
              </div>
            ) : (
              <table>
                <thead><tr>
                  <th>#</th>
                  <th>{t('code')}</th>
                  <th>{t('nameAr')}</th>
                  <th>{t('nameEn')}</th>
                  <th>{t('category')}</th>
                  <th>{t('unit')}</th>
                  <th>{t('currentStock')}</th>
                  <th>{t('minStock')}</th>
                  <th>{t('costPerUnit')}</th>
                  <th>{t('totalValue')}</th>
                  <th>{t('actions')}</th>
                </tr></thead>
                <tbody>
                  {filtered.map((it, i) => {
                    const low = it.currentStock <= it.minStock;
                    const cat = INGREDIENT_CATEGORIES.find(c => c.key === it.category);
                    return (
                      <tr key={it.id} style={low ? { background: '#fef2f2' } : {}}>
                        <td>{i + 1}</td>
                        <td>
                          {it.code && (
                            <span style={{
                              background: '#f0fdfa', border: '1px solid #0d9488',
                              borderRadius: 4, padding: '1px 6px',
                              fontSize: '.75rem', fontFamily: 'monospace', color: '#0f766e',
                            }}>{it.code}</span>
                          )}
                        </td>
                        <td>
                          <strong>{it.nameAr || it.name}</strong>
                          {low && <span style={{ color: '#dc2626', marginRight: 6 }}>⚠️</span>}
                        </td>
                        <td style={{ color: '#64748b', fontSize: '.85rem' }}>{it.nameEn || '—'}</td>
                        <td>
                          {cat && (
                            <span style={{ fontSize: '.8rem' }}>
                              {cat.code && <span style={{ color: '#94a3b8', fontFamily: 'monospace', marginLeft: 4 }}>[{cat.code}]</span>}
                              {' '}{getCatLabel(cat, lang)}
                            </span>
                          )}
                        </td>
                        <td>{it.unit}</td>
                        <td><strong>{it.currentStock}</strong></td>
                        <td>{it.minStock}</td>
                        <td>{Number(it.costPerUnit).toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</td>
                        <td>{(it.currentStock * it.costPerUnit).toFixed(3)} {isAr ? 'د.ك' : 'KWD'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(it)}>
                              {t('edit')}
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(it.id)}>
                              {t('delete')}
                            </button>
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
          title={isAr ? 'إدارة تصنيفات المخزون' : 'Manage Inventory Categories'}
          categories={INGREDIENT_CATEGORIES}
          onSave={async (newCats) => {
            await setInventoryCategories(newCats);
            setCategories(newCats);
            setShowCatMgr(false);
            setMsg(isAr ? 'تم حفظ التصنيفات' : 'Categories saved');
            setTimeout(() => setMsg(''), 2000);
          }}
          onClose={() => setShowCatMgr(false)}
        />
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <h3>{editItem ? t('editIngredient') : t('addIngredient')}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-2">

                {/* Code */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">{t('code')}</label>
                  <input
                    className="form-control"
                    placeholder={isAr ? 'مثال: MT-001' : 'e.g. MT-001'}
                    style={{ fontFamily: 'monospace' }}
                    value={form.code}
                    onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                  />
                </div>

                {/* Arabic Name */}
                <div className="form-group">
                  <label className="form-label">{t('nameAr')} *</label>
                  <input
                    className="form-control"
                    dir="rtl"
                    value={form.nameAr}
                    onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))}
                  />
                </div>

                {/* English Name */}
                <div className="form-group">
                  <label className="form-label">{t('nameEn')}</label>
                  <input
                    className="form-control"
                    dir="ltr"
                    value={form.nameEn}
                    onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))}
                  />
                </div>

                {/* Category */}
                <div className="form-group">
                  <label className="form-label">{t('category')}</label>
                  <select
                    className="form-control"
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  >
                    {catOptions.map(c => (
                      <option key={c.key} value={c.key}>
                        {c.code ? `[${c.code}] ` : ''}{c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Unit */}
                <div className="form-group">
                  <label className="form-label">{t('unit')}</label>
                  <select
                    className="form-control"
                    value={form.unit}
                    onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

                {/* Stock fields */}
                <div className="form-group">
                  <label className="form-label">{t('currentStock')}</label>
                  <input type="number" step="0.001" className="form-control"
                    value={form.currentStock}
                    onChange={e => setForm(p => ({ ...p, currentStock: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('minStock')}</label>
                  <input type="number" step="0.001" className="form-control"
                    value={form.minStock}
                    onChange={e => setForm(p => ({ ...p, minStock: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('costPerUnit')} ({isAr ? 'د.ك' : 'KWD'})</label>
                  <input type="number" step="0.001" className="form-control"
                    value={form.costPerUnit}
                    onChange={e => setForm(p => ({ ...p, costPerUnit: e.target.value }))} />
                </div>

                {/* Weight per unit (only for piece/box/carton) */}
                {PIECE_UNITS.includes(form.unit) && (
                  <div className="form-group">
                    <label className="form-label">
                      {t('unitWeight')} <span className="required">*</span>
                    </label>
                    <input type="number" step="0.01" className="form-control"
                      placeholder={isAr ? 'مثلاً: 150' : 'e.g. 150'}
                      value={form.weightPerUnit}
                      onChange={e => setForm(p => ({ ...p, weightPerUnit: e.target.value }))} />
                    <small style={{ color: '#94a3b8', fontSize: '.72rem' }}>
                      {isAr
                        ? `مهم لحساب الإنتاج — جرامات الـ${form.unit} الواحدة`
                        : `Required for production — grams per ${form.unit}`}
                    </small>
                  </div>
                )}

                {/* Notes */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">{t('notes')}</label>
                  <input className="form-control"
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>

              <button
                className="btn btn-primary btn-full"
                onClick={handleSave}
                disabled={saving}
              >
                {saving
                  ? (isAr ? 'جاري الحفظ...' : 'Saving...')
                  : editItem
                    ? (isAr ? 'حفظ التعديلات' : 'Save Changes')
                    : (isAr ? 'إضافة' : 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
