import { useState, useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  getMealRecipes, saveMealRecipe, deleteMealRecipe, bulkImportMealRecipes,
} from '../firebase/mealRecipeService';
import { getInventory } from '../firebase/inventoryService';
import {
  exportToExcel, importFromExcel, printArea, exportToPDF, exportMultiSheet, exportMultiSheetWithValidation,
} from '../utils/excelUtils';
import { getInventoryCategories } from '../firebase/categoryService';

const EMPTY_ING = { ingredientId: '', name: '', gramsPerBase: 0 };

export default function MealRecipesPage() {
  const [meals, setMeals] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editMeal, setEditMeal] = useState(null);
  const [form, setForm] = useState({ baseGrams: 100, ingredients: [EMPTY_ING] });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // '', 'with', 'without'
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const [mealsSnap, r, inv] = await Promise.all([
      getDocs(collection(db, 'meals')),
      getMealRecipes(),
      getInventory(),
    ]);
    setMeals(mealsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setRecipes(r);
    setInventory(inv);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const recipesById = {};
  recipes.forEach(r => { recipesById[r.id] = r; });

  const enriched = meals.map(m => ({
    ...m,
    hasRecipe: !!recipesById[m.id],
    recipe: recipesById[m.id],
  }));

  const filtered = enriched.filter(m => {
    if (search && !m.mealTitle?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus === 'with' && !m.hasRecipe) return false;
    if (filterStatus === 'without' && m.hasRecipe) return false;
    return true;
  });

  const withRecipes = enriched.filter(m => m.hasRecipe).length;
  const withoutRecipes = enriched.length - withRecipes;

  const openEdit = (meal) => {
    setEditMeal(meal);
    const r = meal.recipe;
    setForm({
      baseGrams: r?.baseGrams || 100,
      ingredients: r?.ingredients?.length ? r.ingredients : [EMPTY_ING],
    });
    setShowForm(true);
  };

  const updIng = (idx, key, val) => {
    setForm(p => {
      const items = [...p.ingredients];
      items[idx] = { ...items[idx], [key]: val };
      if (key === 'ingredientId') {
        const inv = inventory.find(i => i.id === val);
        if (inv) items[idx].name = inv.name;
      }
      return { ...p, ingredients: items };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await saveMealRecipe(editMeal.id, {
      mealName: editMeal.mealTitle,
      baseGrams: form.baseGrams,
      ingredients: form.ingredients.filter(i => i.name && i.gramsPerBase > 0),
    });
    setSaving(false); setShowForm(false);
    setMsg('تم الحفظ');
    load();
    setTimeout(() => setMsg(''), 2000);
  };

  const handleDelete = async (id) => {
    if (window.confirm('حذف الوصفة؟')) { await deleteMealRecipe(id); load(); }
  };

  // Export current recipes (long format: one row per ingredient)
  const handleExport = () => {
    const rows = [];
    recipes.forEach(r => {
      const meal = meals.find(m => m.id === r.id);
      (r.ingredients || []).forEach(ing => {
        rows.push({
          'mealId': r.id,
          'اسم الوجبة': meal?.mealTitle || r.mealName || '',
          'الحجم الأساسى (جرام)': r.baseGrams,
          'المكون': ing.name,
          'الجرامات': ing.gramsPerBase,
        });
      });
    });
    if (rows.length === 0) { setMsg('لا توجد وصفات للتصدير'); return; }
    exportToExcel(rows, `meal_recipes_${new Date().toISOString().slice(0,10)}.xlsx`, 'الوصفات');
  };

  // Sample template — multi-sheet: meals + inventory reference + instructions
  const handleTemplate = async () => {
    if (meals.length === 0) {
      setMsg('لا توجد وجبات فى السيستم بعد');
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    if (inventory.length === 0) {
      const ok = window.confirm('⚠️ لا توجد مكونات فى المخزون!\n\nيُفضّل إدخال المكونات أولاً فى صفحة المخزون عشان تنسخ أسماءها بالظبط.\n\nاستكمال تحميل القالب الفارغ؟');
      if (!ok) return;
    }

    const cats = await getInventoryCategories();
    const catMap = {};
    cats.forEach(c => { catMap[c.key] = c.label; });

    // Sheet 1: template — one row per meal (sample row for first meal showing 3 ingredients pattern)
    const templateRows = [];
    meals.forEach((m, idx) => {
      // For the first meal, give 3 example placeholder rows so user sees the pattern
      const reps = idx === 0 ? 3 : 1;
      for (let i = 0; i < reps; i++) {
        templateRows.push({
          'mealId': m.id,
          'اسم الوجبة': m.mealTitle || '',
          'الحجم الأساسى (جرام)': 100,
          'المكون': '',
          'الجرامات': '',
        });
      }
    });

    // Sheet 2: inventory reference (all available ingredients with units + categories)
    const inventoryRows = inventory.length === 0
      ? [{ 'ملاحظة': 'لا توجد مكونات — أضفها أولاً من صفحة المخزون' }]
      : inventory.map(i => ({
          'اسم المكون': i.name,
          'الوحدة': i.unit,
          'التصنيف': catMap[i.category] || i.category,
          'تكلفة الوحدة': Number(i.costPerUnit || 0).toFixed(3) + ' د.ك',
          'المخزون الحالى': `${i.currentStock} ${i.unit}`,
        }));

    // Sheet 3: instructions
    const instructionRows = [
      { 'الخطوة': '1', 'الشرح': 'افتح شيت "وصفات الوجبات" — هتلاقى كل الوجبات الموجودة فى السيستم' },
      { 'الخطوة': '2', 'الشرح': 'لكل وجبة فيها أكتر من مكون: انسخ الصف وغيّر فى نسخه المكون والجرامات' },
      { 'الخطوة': '3', 'الشرح': 'مهم: لا تغيّر mealId — لازم يفضل ثابت فى كل صفوف نفس الوجبة' },
      { 'الخطوة': '4', 'الشرح': 'اسم المكون: انسخه بالظبط من شيت "قائمة المخزون" — أى اختلاف ولو حرف بيقطع الربط بالمخزون' },
      { 'الخطوة': '5', 'الشرح': 'الجرامات: مجموعها فى الوجبة الواحدة المفروض = الحجم الأساسى' },
      { 'الخطوة': '', 'الشرح': '' },
      { 'الخطوة': 'مثال:', 'الشرح': 'دجاج مشوى 100 جرام = 60 دجاج + 25 أرز + 10 خضار + 2 بهارات + 3 كاتشب → 5 صفوف' },
      { 'الخطوة': '', 'الشرح': '' },
      { 'الخطوة': 'تنبيه:', 'الشرح': 'لو وجبة بحجم 150 جرام، النظام بيضرب الكل × 1.5 تلقائياً' },
    ];

    // Build dropdown validation for "المكون" column (column D — index 3, header in row 1)
    // Range covers data rows 2 to 1000+ to support adding rows
    const lastInventoryRow = Math.max(inventoryRows.length + 1, 2);
    const validations = inventory.length > 0 ? [{
      sheetIndex: 0,  // وصفات الوجبات is sheet 1 (index 0)
      sqref: `D2:D${Math.max(templateRows.length + 200, 500)}`,
      // Reference inventory sheet column A (اسم المكون) excluding header
      listFormula: `'قائمة المخزون'!$A$2:$A$${lastInventoryRow}`,
    }] : [];

    exportMultiSheetWithValidation([
      { name: 'وصفات الوجبات', rows: templateRows },
      { name: 'قائمة المخزون', rows: inventoryRows },
      { name: 'التعليمات', rows: instructionRows },
    ], 'meal_recipes_template.xlsx', validations);

    setMsg('✅ تم تحميل القالب — خانة المكون فيها قائمة منسدلة من المخزون');
    setTimeout(() => setMsg(''), 5000);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const rows = await importFromExcel(file);
      // Validate: collect ingredient names that don't match inventory
      const invNames = new Set(inventory.map(i => i.name));
      const unknown = new Set();
      rows.forEach(row => {
        const ingName = (row['المكون'] || row.ingredient || '').trim();
        const grams = Number(row['الجرامات'] || row.grams || 0);
        if (ingName && grams > 0 && !invNames.has(ingName)) unknown.add(ingName);
      });
      if (unknown.size > 0) {
        const list = [...unknown].slice(0, 10).join('، ');
        const ok = window.confirm(
          `⚠️ ${unknown.size} مكون غير موجود فى المخزون:\n${list}${unknown.size > 10 ? '\n...' : ''}\n\nهيتم استيرادها بدون ربط بالمخزون (ومش هتتخصم منه فى الإنتاج).\n\nاستكمال؟`
        );
        if (!ok) { e.target.value = ''; return; }
      }
      const count = await bulkImportMealRecipes(rows, inventory);
      setMsg(`✅ تم استيراد ${count} وصفة${unknown.size > 0 ? ` (${unknown.size} مكون غير مربوط بالمخزون)` : ''}`);
      load();
    } catch (err) { setMsg('فشل الاستيراد: ' + err.message); }
    e.target.value = '';
    setTimeout(() => setMsg(''), 5000);
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>📖 وصفات الوجبات</h2><div className="breadcrumb">المالية والعمليات / وصفات الوجبات</div></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>📥 استيراد</button>
          <button className="btn btn-ghost" onClick={handleExport}>📤 Excel</button>
          <button className="btn btn-ghost" onClick={handleTemplate}>📋 قالب (كل الوجبات)</button>
          <button className="btn btn-ghost" onClick={() => exportToPDF('mr-print', 'وصفات الوجبات')}>📄 PDF</button>
          <button className="btn btn-ghost" onClick={() => printArea('mr-print', 'وصفات الوجبات')}>🖨️ طباعة</button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div className="alert alert-info fade-in" style={{ marginBottom:16 }}>
          💡 <strong>كيف تشتغل:</strong> حدّد لكل وجبة <strong>الحجم الأساسى</strong> (مثلاً 100 جرام) والمكونات بالجرامات. النظام بيضرب فى scale لو الوجبة المنتجة بحجم مختلف (مثلاً 150g = ضرب فى 1.5).
          <br/>📋 <strong>القالب فيه 3 شيتات:</strong> "وصفات الوجبات" (للتعبئة) + "قائمة المخزون" (مرجع للأسماء — انسخ منه) + "التعليمات".
          {inventory.length === 0 && <><br/>⚠️ <strong>أدخل المكونات أولاً فى صفحة المخزون</strong> قبل ما تحمّل القالب.</>}
        </div>

        <div className="stats-grid" style={{ marginBottom:16 }}>
          <div className="stat-card"><div className="stat-label">إجمالى الوجبات</div><div className="stat-value">{meals.length}</div></div>
          <div className="stat-card"><div className="stat-label">لها وصفات</div><div className="stat-value" style={{ color:'#0d9488' }}>{withRecipes}</div></div>
          <div className="stat-card"><div className="stat-label">بدون وصفات</div><div className="stat-value" style={{ color:'#dc2626' }}>{withoutRecipes}</div></div>
        </div>

        <div className="card">
          <div className="card-header" style={{ flexWrap:'wrap', gap:10 }}>
            <h3>قائمة الوجبات</h3>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <input className="form-control" placeholder="🔍 بحث..." value={search} onChange={e=>setSearch(e.target.value)} style={{ maxWidth:200 }} />
              <select className="form-control" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ maxWidth:180 }}>
                <option value="">كل الوجبات</option>
                <option value="with">لها وصفة فقط</option>
                <option value="without">بدون وصفة فقط</option>
              </select>
            </div>
          </div>
          <div className="table-wrapper" id="mr-print">
            {loading ? <div className="loading"><div className="spinner" />جاري التحميل...</div>
            : filtered.length === 0 ? <div className="empty-state"><div className="empty-icon">📖</div><h3>لا توجد وجبات</h3></div>
            : (
              <table>
                <thead><tr>
                  <th>#</th><th>اسم الوجبة</th><th>النوع</th>
                  <th>الحجم الأساسى</th><th>عدد المكونات</th><th>الحالة</th><th>الإجراءات</th>
                </tr></thead>
                <tbody>
                  {filtered.map((m, i) => (
                    <tr key={m.id} style={!m.hasRecipe ? { background:'#fef2f2' } : {}}>
                      <td>{i+1}</td>
                      <td><strong>{m.mealTitle}</strong></td>
                      <td>{m.mealType || '-'}</td>
                      <td>{m.recipe?.baseGrams || '—'} {m.recipe ? 'جرام' : ''}</td>
                      <td>{m.recipe?.ingredients?.length || 0}</td>
                      <td>
                        {m.hasRecipe
                          ? <span className="badge" style={{ background:'#dcfce7', color:'#16a34a' }}>✓ مكتمل</span>
                          : <span className="badge" style={{ background:'#fee2e2', color:'#dc2626' }}>⚠️ لا توجد وصفة</span>}
                      </td>
                      <td><div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(m)}>{m.hasRecipe ? 'تعديل' : '+ إضافة'}</button>
                        {m.hasRecipe && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}>حذف</button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showForm && editMeal && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:800 }}>
            <div className="modal-header">
              <h3>وصفة: {editMeal.mealTitle}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">الحجم الأساسى (جرام) — كل المكونات تحت بتنتج هذا الحجم</label>
                <input type="number" className="form-control" value={form.baseGrams}
                  onChange={e => setForm(p => ({...p, baseGrams: e.target.value}))} />
              </div>

              <h4 style={{ margin:'16px 0 8px' }}>المكونات</h4>
              {form.ingredients.map((ing, idx) => (
                <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 1fr auto', gap:8, marginBottom:8 }}>
                  <select className="form-control" value={ing.ingredientId} onChange={e => updIng(idx, 'ingredientId', e.target.value)}>
                    <option value="">-- مكون من المخزون --</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                  </select>
                  <input type="number" step="0.01" className="form-control" placeholder="جرامات"
                    value={ing.gramsPerBase} onChange={e => updIng(idx, 'gramsPerBase', e.target.value)} />
                  <button className="btn btn-danger btn-sm"
                    onClick={() => setForm(p => ({...p, ingredients: p.ingredients.filter((_, i) => i !== idx)}))}>×</button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm"
                onClick={() => setForm(p => ({...p, ingredients:[...p.ingredients, EMPTY_ING]}))}>+ مكون</button>

              <div style={{ marginTop:12, padding:10, background:'#f8fafc', borderRadius:6, fontSize:'.85rem', color:'#64748b' }}>
                مجموع جرامات المكونات: <strong>{form.ingredients.reduce((s, i) => s + (Number(i.gramsPerBase) || 0), 0)} جرام</strong>
              </div>

              <button className="btn btn-primary btn-full" style={{ marginTop:16 }} onClick={handleSave} disabled={saving}>
                {saving ? 'جاري الحفظ...' : 'حفظ الوصفة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
