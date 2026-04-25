import { useState, useEffect } from 'react';
import {
  getRecipes, addRecipe, updateRecipe, deleteRecipe,
  calcRecipeCost, calcFoodCostPct,
} from '../firebase/recipeService';
import { getInventory } from '../firebase/inventoryService';
import { exportToExcel, printArea } from '../utils/excelUtils';

const EMPTY_ING = { ingredientId: '', name: '', quantity: 0, unit: '', costPerUnit: 0 };
const EMPTY = { name: '', sellingPrice: 0, ingredients: [EMPTY_ING], notes: '' };

export default function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    const [r, i] = await Promise.all([getRecipes(), getInventory()]);
    setRecipes(r); setInventory(i);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditItem(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (r) => { setEditItem(r); setForm({ ...EMPTY, ...r, ingredients: r.ingredients || [EMPTY_ING] }); setShowForm(true); };

  const updIng = (idx, key, val) => {
    setForm(p => {
      const ings = [...p.ingredients];
      ings[idx] = { ...ings[idx], [key]: val };
      if (key === 'ingredientId') {
        const ing = inventory.find(i => i.id === val);
        if (ing) { ings[idx].name = ing.name; ings[idx].unit = ing.unit; ings[idx].costPerUnit = ing.costPerUnit || 0; }
      }
      return { ...p, ingredients: ings };
    });
  };

  const formCost = calcRecipeCost(form.ingredients);
  const formPct = calcFoodCostPct(formCost, form.sellingPrice);

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    if (editItem) await updateRecipe(editItem.id, form);
    else await addRecipe(form);
    setSaving(false); setShowForm(false);
    setMsg(editItem ? 'تم التعديل' : 'تمت الإضافة');
    load();
    setTimeout(() => setMsg(''), 2000);
  };

  const handleDelete = async (id) => {
    if (window.confirm('حذف الوصفة؟')) { await deleteRecipe(id); load(); }
  };

  const handleExport = () => {
    const rows = recipes.map(r => ({
      'اسم الوصفة': r.name,
      'التكلفة': (r.totalCost || 0).toFixed(3),
      'سعر البيع': Number(r.sellingPrice || 0).toFixed(3),
      'هامش الربح': (Number(r.sellingPrice || 0) - (r.totalCost || 0)).toFixed(3),
      'Food Cost %': calcFoodCostPct(r.totalCost, r.sellingPrice),
      'عدد المكونات': r.ingredients?.length || 0,
    }));
    exportToExcel(rows, `recipes_${new Date().toISOString().slice(0,10)}.xlsx`, 'الوصفات');
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>📖 الوصفات والتكاليف</h2><div className="breadcrumb">المالية والعمليات / الوصفات</div></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-ghost" onClick={handleExport}>📤 تصدير</button>
          <button className="btn btn-ghost" onClick={() => printArea('rec-print', 'تقرير الوصفات')}>🖨️ طباعة</button>
          <button className="btn btn-primary" onClick={openAdd}>+ وصفة</button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div className="card">
          <div className="card-header"><h3>قائمة الوصفات</h3><span className="badge badge-teal">{recipes.length}</span></div>
          <div className="table-wrapper" id="rec-print">
            {loading ? <div className="loading"><div className="spinner" />جاري التحميل...</div>
            : recipes.length === 0 ? <div className="empty-state"><div className="empty-icon">📖</div><h3>لا توجد وصفات</h3></div>
            : (
              <table>
                <thead><tr>
                  <th>#</th><th>الاسم</th><th>المكونات</th><th>التكلفة</th>
                  <th>سعر البيع</th><th>الهامش</th><th>Food Cost %</th><th>الإجراءات</th>
                </tr></thead>
                <tbody>
                  {recipes.map((r, i) => {
                    const margin = Number(r.sellingPrice || 0) - (r.totalCost || 0);
                    const pct = Number(calcFoodCostPct(r.totalCost, r.sellingPrice));
                    const pctClr = pct > 35 ? '#dc2626' : pct > 25 ? '#f59e0b' : '#0d9488';
                    return (
                      <tr key={r.id}>
                        <td>{i+1}</td>
                        <td><strong>{r.name}</strong></td>
                        <td>{r.ingredients?.length || 0}</td>
                        <td>{(r.totalCost || 0).toFixed(3)} د.ك</td>
                        <td>{Number(r.sellingPrice || 0).toFixed(3)} د.ك</td>
                        <td style={{ color: margin > 0 ? '#0d9488' : '#dc2626' }}>{margin.toFixed(3)} د.ك</td>
                        <td><span className="badge" style={{ background: pctClr + '22', color: pctClr }}>{pct}%</span></td>
                        <td><div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(r)}>تعديل</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>حذف</button>
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
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:800 }}>
            <div className="modal-header">
              <h3>{editItem ? 'تعديل وصفة' : 'وصفة جديدة'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-2">
                <div className="form-group"><label className="form-label">اسم الوصفة *</label>
                  <input className="form-control" value={form.name} onChange={e => setForm(p => ({...p, name:e.target.value}))} /></div>
                <div className="form-group"><label className="form-label">سعر البيع (د.ك)</label>
                  <input type="number" step="0.001" className="form-control" value={form.sellingPrice}
                    onChange={e => setForm(p => ({...p, sellingPrice:e.target.value}))} /></div>
              </div>

              <h4 style={{ margin:'16px 0 8px' }}>المكونات</h4>
              {form.ingredients.map((ing, idx) => (
                <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:8, marginBottom:8 }}>
                  <select className="form-control" value={ing.ingredientId} onChange={e => updIng(idx, 'ingredientId', e.target.value)}>
                    <option value="">-- مكون --</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <input type="number" step="0.001" className="form-control" placeholder="الكمية"
                    value={ing.quantity} onChange={e => updIng(idx, 'quantity', e.target.value)} />
                  <input type="number" step="0.001" className="form-control" placeholder="تكلفة/وحدة"
                    value={ing.costPerUnit} onChange={e => updIng(idx, 'costPerUnit', e.target.value)} />
                  <button className="btn btn-danger btn-sm" onClick={() => setForm(p => ({...p, ingredients: p.ingredients.filter((_, i) => i !== idx)}))}>×</button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={() => setForm(p => ({...p, ingredients:[...p.ingredients, EMPTY_ING]}))}>+ مكون</button>

              <div style={{ marginTop:16, padding:12, background:'#f8fafc', borderRadius:8 }}>
                <div>التكلفة الإجمالية: <strong>{formCost.toFixed(3)} د.ك</strong></div>
                <div>Food Cost %: <strong style={{ color: formPct > 35 ? '#dc2626' : '#0d9488' }}>{formPct}%</strong></div>
              </div>

              <button className="btn btn-primary btn-full" style={{ marginTop:16 }} onClick={handleSave} disabled={saving}>
                {saving ? 'جاري الحفظ...' : editItem ? 'حفظ' : 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
