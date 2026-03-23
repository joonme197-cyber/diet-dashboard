import { useState, useEffect } from 'react';
import { getPackages, addPackage, updatePackage, deletePackage } from '../firebase/packageService';
import { getCategories } from '../firebase/packageService';

const EMPTY_PACKAGE = {
  nameAr: '', nameEn: '',
  categoryId: '', categoryName: '',
  bundleType: 'normal',
  mealsNumber: 3, snacksNumber: 1,
  carbohydrates: 100, protein: 150,
  allowedBreakfast: 2, allowedLunch: 2, allowedDinner: 2,
  textOnCardAr: '', textOnCardEn: '',
  offersDays: 0,
  fridays: false,
  deactivate: false,
  mealTypes: { breakfast: true, lunch: true, dinner: true },
  prices: [],
};

const DURATION_OPTIONS = [
  '1 أسبوع', '2 أسبوع', '3 أسابيع',
  '1 شهر', '2 شهر', '3 شهور'
];

export default function PackagesPage() {
  const [packages, setPackages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_PACKAGE);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    const [pkgs, cats] = await Promise.all([getPackages(), getCategories()]);
    setPackages(pkgs);
    setCategories(cats);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (key, val) => setForm(p => ({ ...p, [key]: val }));
  const updateNested = (obj, key, val) => setForm(p => ({ ...p, [obj]: { ...p[obj], [key]: val } }));

  const openAdd = () => {
    setEditItem(null);
    setForm(EMPTY_PACKAGE);
    setShowForm(true);
  };

  const openEdit = (pkg) => {
    setEditItem(pkg);
    setForm({ ...EMPTY_PACKAGE, ...pkg });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nameAr || !form.nameEn) {
      alert('الاسم العربي والإنجليزي مطلوبان');
      return;
    }
    setSaving(true);
    const cat = categories.find(c => c.id === form.categoryId);
    const data = { ...form, categoryName: cat?.nameEn || '' };
    if (editItem) {
      await updatePackage(editItem.id, data);
      setMsg('تم التعديل بنجاح');
    } else {
      await addPackage(data);
      setMsg('تمت الإضافة بنجاح');
    }
    setSaving(false);
    setShowForm(false);
    load();
    setTimeout(() => setMsg(''), 2000);
  };

  const handleDelete = async (id) => {
    if (window.confirm('هل تريد حذف هذه الباقة؟')) {
      await deletePackage(id);
      load();
    }
  };

  // جدول الأسعار الديناميكي
  const addPrice = () => {
    setForm(p => ({ ...p, prices: [...p.prices, { duration: '', price: '' }] }));
  };

  const updatePrice = (i, key, val) => {
    setForm(p => {
      const prices = [...p.prices];
      prices[i] = { ...prices[i], [key]: val };
      return { ...p, prices };
    });
  };

  const removePrice = (i) => {
    setForm(p => ({ ...p, prices: p.prices.filter((_, idx) => idx !== i) }));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>الباقات</h2>
          <div className="breadcrumb">الباقات / قائمة الباقات</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ إضافة باقة</button>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div className="card">
          <div className="card-header">
            <h3>قائمة الباقات</h3>
            <span className="badge badge-teal">{packages.length} باقة</span>
          </div>
          <div className="table-wrapper">
            {loading ? (
              <div className="loading"><div className="spinner" />جاري التحميل...</div>
            ) : packages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <h3>لا يوجد باقات</h3>
                <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={openAdd}>
                  + إضافة باقة
                </button>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>التصنيف</th>
                    <th>النوع</th>
                    <th>الوجبات</th>
                    <th>P / C</th>
                    <th>الأسعار</th>
                    <th>الجمعة</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map(pkg => (
                    <tr key={pkg.id} className="fade-in">
                      <td>
                        <strong>{pkg.nameAr}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{pkg.nameEn}</div>
                      </td>
                      <td>
                        <span className="badge badge-teal">{pkg.categoryName || '---'}</span>
                      </td>
                      <td>
                        <span className={`badge ${pkg.bundleType === 'normal' ? 'badge-green' : 'badge-orange'}`}>
                          {pkg.bundleType === 'normal' ? 'ثابتة' : 'مرنة'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {pkg.mealsNumber} وجبة / {pkg.snacksNumber} سناك
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
                        P{pkg.protein} / C{pkg.carbohydrates}
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>
                        {(pkg.prices || []).map((p, i) => (
                          <div key={i}>{p.duration}: <strong>{p.price} KWD</strong></div>
                        ))}
                      </td>
                      <td>
                        <span className={`badge ${pkg.fridays ? 'badge-green' : 'badge-orange'}`}>
                          {pkg.fridays ? 'نعم' : 'لا'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${pkg.deactivate ? 'badge-orange' : 'badge-green'}`}>
                          {pkg.deactivate ? 'معطل' : 'نشط'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(pkg)}>تعديل</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(pkg.id)}>حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'تعديل باقة' : 'إضافة باقة جديدة'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>X</button>
            </div>
            <div className="modal-body">

              {/* نوع الباقة */}
              <div className="section-title">نوع الباقة</div>
              <div className="radio-group" style={{ marginBottom: '20px' }}>
                <div className="radio-option">
                  <input type="radio" id="normal" name="bundleType"
                    checked={form.bundleType === 'normal'}
                    onChange={() => update('bundleType', 'normal')} />
                  <label htmlFor="normal">باقة ثابتة (Normal)</label>
                </div>
                <div className="radio-option">
                  <input type="radio" id="flex" name="bundleType"
                    checked={form.bundleType === 'flex'}
                    onChange={() => update('bundleType', 'flex')} />
                  <label htmlFor="flex">باقة مرنة (Flex)</label>
                </div>
              </div>

              {/* التصنيف والاسم */}
              <div className="section-title">المعلومات الأساسية</div>
              <div className="form-grid" style={{ marginBottom: '16px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">التصنيف</label>
                  <select className="form-control"
                    value={form.categoryId}
                    onChange={e => update('categoryId', e.target.value)}>
                    <option value="">-- اختر التصنيف --</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.nameAr} - {c.nameEn}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">الاسم بالعربي *</label>
                  <input className="form-control" placeholder="مثال: باقة نزول وزن مع فطور"
                    value={form.nameAr} onChange={e => update('nameAr', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Package English Name *</label>
                  <input className="form-control" placeholder="e.g. Weight loss package with breakfast"
                    value={form.nameEn} onChange={e => update('nameEn', e.target.value)} />
                </div>
              </div>

              {/* تفاصيل التكوين */}
              <div className="section-title">تفاصيل التكوين</div>
              <div className="form-grid col-4" style={{ marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Meals Number</label>
                  <div className="number-input">
                    <button type="button" onClick={() => update('mealsNumber', Math.max(1, form.mealsNumber - 1))}>-</button>
                    <input type="number" value={form.mealsNumber} readOnly />
                    <button type="button" onClick={() => update('mealsNumber', Math.min(6, form.mealsNumber + 1))}>+</button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Snacks Number</label>
                  <div className="number-input">
                    <button type="button" onClick={() => update('snacksNumber', Math.max(0, form.snacksNumber - 1))}>-</button>
                    <input type="number" value={form.snacksNumber} readOnly />
                    <button type="button" onClick={() => update('snacksNumber', Math.min(3, form.snacksNumber + 1))}>+</button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Carbohydrates</label>
                  <input className="form-control" type="number" value={form.carbohydrates}
                    onChange={e => update('carbohydrates', parseInt(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Protein</label>
                  <input className="form-control" type="number" value={form.protein}
                    onChange={e => update('protein', parseInt(e.target.value))} />
                </div>
              </div>

              {/* Allowed */}
              <div className="form-grid" style={{ marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Allowed Breakfast</label>
                  <input className="form-control" type="number" value={form.allowedBreakfast}
                    onChange={e => update('allowedBreakfast', parseInt(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Allowed Lunch</label>
                  <input className="form-control" type="number" value={form.allowedLunch}
                    onChange={e => update('allowedLunch', parseInt(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Allowed Dinner</label>
                  <input className="form-control" type="number" value={form.allowedDinner}
                    onChange={e => update('allowedDinner', parseInt(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Offers Days</label>
                  <input className="form-control" type="number" value={form.offersDays}
                    onChange={e => update('offersDays', parseInt(e.target.value))} />
                </div>
              </div>

              {/* Text on Card */}
              <div className="section-title">النص على الكارت</div>
              <div className="form-grid" style={{ marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Arabic Text on Card</label>
                  <input className="form-control" placeholder="مثال: 90 بروتين 90 كارب"
                    value={form.textOnCardAr} onChange={e => update('textOnCardAr', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">English Text on Card</label>
                  <input className="form-control" placeholder="e.g. 90 Protein 90 Carb"
                    value={form.textOnCardEn} onChange={e => update('textOnCardEn', e.target.value)} />
                </div>
              </div>

              {/* Meal Types */}
              <div className="section-title">أنواع الوجبات</div>
              <div className="checkbox-row" style={{ marginBottom: '20px' }}>
                {[['breakfast','Breakfast'],['lunch','Lunch'],['dinner','Dinner']].map(([key, label]) => (
                  <label key={key} className="checkbox-item">
                    <input type="checkbox"
                      checked={form.mealTypes?.[key] || false}
                      onChange={e => updateNested('mealTypes', key, e.target.checked)} />
                    <label>{label}</label>
                  </label>
                ))}
              </div>

              {/* Toggles */}
              <div className="section-title">الخيارات</div>
              <div className="checkbox-row" style={{ marginBottom: '20px' }}>
                <label className="checkbox-item">
                  <input type="checkbox" checked={form.fridays}
                    onChange={e => update('fridays', e.target.checked)} />
                  <label>Fridays (يشمل الجمعة)</label>
                </label>
                <label className="checkbox-item">
                  <input type="checkbox" checked={form.deactivate}
                    onChange={e => update('deactivate', e.target.checked)} />
                  <label>Deactivate (تعطيل مؤقت)</label>
                </label>
              </div>

              {/* جدول الأسعار الديناميكي */}
              <div className="section-title">
                جدول الأسعار
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ marginRight: 'auto' }}
                  onClick={addPrice}
                >
                  + إضافة مدة
                </button>
              </div>

              {form.prices.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px', fontSize: '0.85rem' }}>
                  لا يوجد أسعار — اضغط "+ إضافة مدة"
                </div>
              ) : (
                <div style={{ marginBottom: '20px' }}>
                  {form.prices.map((price, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: '10px', alignItems: 'center',
                      marginBottom: '10px', padding: '10px 14px',
                      background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'
                    }}>
                      <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                        <select className="form-control"
                          value={price.duration}
                          onChange={e => updatePrice(i, 'duration', e.target.value)}>
                          <option value="">-- اختر المدة --</option>
                          {DURATION_OPTIONS.map(d => <option key={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            className="form-control"
                            type="number"
                            placeholder="السعر"
                            value={price.price}
                            onChange={e => updatePrice(i, 'price', e.target.value)}
                          />
                          <span style={{ color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>KWD</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePrice(i)}
                        style={{
                          background: '#fee2e2', color: '#ef4444', border: 'none',
                          borderRadius: '8px', padding: '8px 12px', cursor: 'pointer',
                          fontWeight: 700, fontSize: '1rem'
                        }}
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Save */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                  {saving ? 'جاري الحفظ...' : editItem ? 'حفظ التعديلات' : 'إضافة الباقة'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
