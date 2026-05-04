import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPackages, addPackage, updatePackage, deletePackage, reorderPackages, reorderCategories } from '../firebase/packageService';
import { getCategories, addCategory, updateCategory, deleteCategory } from '../firebase/packageService';

const EMPTY_PACKAGE = {
  nameAr: '', nameEn: '',
  categoryId: '', categoryName: '',
  bundleType: 'normal',
  mealsNumber: 3, snacksNumber: 1,
  carbohydrates: 100, protein: 150,
  allowedBreakfast: 1, allowedLunch: 1, allowedDinner: 1,
  textOnCardAr: '', textOnCardEn: '',
  offersDays: 0,
  fridays: false,
  deactivate: false,
  mealTypes: { breakfast: true, lunch: true, dinner: true },
  maxFreezeDays: 0,
  prices: [],
};

const DURATION_OPTIONS = [
  { label: '1 أسبوع',    weeks: 1,  days: 7   },
  { label: '2 أسبوع',    weeks: 2,  days: 14  },
  { label: '3 أسابيع',   weeks: 3,  days: 21  },
  { label: '20 يوم',     weeks: 3,  days: 20  },
  { label: '26 يوم',     weeks: 4,  days: 26  },
  { label: '1 شهر',      weeks: 4,  days: 28  },
  { label: '5 أسابيع',   weeks: 5,  days: 35  },
  { label: '6 أسابيع',   weeks: 6,  days: 42  },
  { label: '2 شهر',      weeks: 8,  days: 56  },
  { label: '3 شهور',     weeks: 12, days: 84  },
  { label: 'مخصص',       weeks: 0,  days: 0   },
];

function PackagesTable({ pkgs, openEdit, handleDelete, onMove }) {
  const sorted = [...pkgs].sort((a,b) => (a.order||0)-(b.order||0));
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style={{ width:60 }}>الترتيب</th>
            <th>الاسم</th>
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
          {sorted.map((pkg, idx) => (
            <tr key={pkg.id} className="fade-in">
              <td>
                <div style={{ display:'flex', flexDirection:'column', gap:2, alignItems:'center' }}>
                  <button onClick={() => onMove(pkg, -1, sorted)} disabled={idx===0}
                    style={{ background:'none', border:'1px solid #e2e8f0', borderRadius:4, cursor:'pointer', padding:'2px 8px', fontSize:'0.7rem', opacity:idx===0?0.3:1 }}>▲</button>
                  <span style={{ fontSize:'0.72rem', color:'#94a3b8' }}>{idx+1}</span>
                  <button onClick={() => onMove(pkg, 1, sorted)} disabled={idx===sorted.length-1}
                    style={{ background:'none', border:'1px solid #e2e8f0', borderRadius:4, cursor:'pointer', padding:'2px 8px', fontSize:'0.7rem', opacity:idx===sorted.length-1?0.3:1 }}>▼</button>
                </div>
              </td>
              <td>
                <strong>{pkg.nameAr}</strong>
                <div style={{ fontSize:'0.75rem', color:'#94a3b8' }}>{pkg.nameEn}</div>
              </td>
              <td>
                <span className={`badge ${pkg.bundleType==='normal'?'badge-green':'badge-orange'}`}>
                  {pkg.bundleType==='normal'?'ثابتة':'مرنة'}
                </span>
              </td>
              <td style={{ fontSize:'0.82rem' }}>
                {pkg.mealsNumber} وجبة / {pkg.snacksNumber} سناك
              </td>
              <td style={{ fontSize:'0.82rem' }}>P{pkg.protein} / C{pkg.carbohydrates}</td>
              <td style={{ fontSize:'0.78rem' }}>
                {(pkg.prices||[]).map((p,i) => (
                  <div key={i}>{p.duration}: <strong>{p.price} KWD</strong></div>
                ))}
              </td>
              <td>
                <span className={`badge ${pkg.fridays?'badge-green':'badge-orange'}`}>
                  {pkg.fridays?'نعم':'لا'}
                </span>
              </td>
              <td>
                <span className={`badge ${pkg.deactivate?'badge-orange':'badge-green'}`}>
                  {pkg.deactivate?'معطل':'نشط'}
                </span>
              </td>
              <td>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button className="btn btn-outline btn-sm" onClick={()=>openEdit(pkg)}>تعديل</button>
                  <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(pkg.id)}>حذف</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PackagesPage() {
  const [searchParams] = useSearchParams();
  const typeFilter = searchParams.get('type'); // 'normal' | 'flex' | null

  const [packages, setPackages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_PACKAGE);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // إدارة التصنيفات
  const [showCatSection, setShowCatSection] = useState(false);
  const [catForm, setCatForm] = useState({ nameAr:'', nameEn:'', icon:'📦', color:'#4DC3E8' });
  const [editCat, setEditCat] = useState(null);
  const [savingCat, setSavingCat] = useState(false);

  const saveCategory = async () => {
    if (!catForm.nameAr || !catForm.nameEn) { setMsg('❌ أدخل اسم التصنيف بالعربي والإنجليزي'); return; }
    setSavingCat(true);
    try {
      if (editCat) {
        await updateDoc(doc(db, 'packageCategories', editCat.id), { ...catForm, updatedAt: serverTimestamp() });
        setMsg('✅ تم تحديث التصنيف');
      } else {
        await addDoc(collection(db, 'packageCategories'), { ...catForm, createdAt: serverTimestamp() });
        setMsg('✅ تم إضافة التصنيف');
      }
      setCatForm({ nameAr:'', nameEn:'', icon:'📦', color:'#4DC3E8' });
      setEditCat(null);
      load();
    } catch(e) { setMsg('❌ ' + e.message); }
    setSavingCat(false);
  };

  const handleDeleteCat = async (cat) => {
    const pkgsInCat = packages.filter(p => p.categoryId === cat.id);
    if (pkgsInCat.length > 0) {
      setMsg(`❌ لا يمكن حذف التصنيف — يحتوي على ${pkgsInCat.length} باقة`);
      return;
    }
    if (!window.confirm(`حذف تصنيف "${cat.nameAr}"؟`)) return;
    await deleteDoc(doc(db, 'packageCategories', cat.id));
    setMsg('✅ تم حذف التصنيف');
    load();
  };

  // ترتيب التصنيفات
  const moveCat = async (cat, dir) => {
    const sorted = [...categories].sort((a,b) => (a.order||0)-(b.order||0));
    const idx = sorted.findIndex(c => c.id === cat.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const ids = sorted.map(c => c.id);
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    await reorderCategories(ids);
    load();
  };

  // ترتيب الباقات داخل تصنيف
  const movePkg = async (pkg, dir, catPkgs) => {
    const sorted = [...catPkgs].sort((a,b) => (a.order||0)-(b.order||0));
    const idx = sorted.findIndex(p => p.id === pkg.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const ids = sorted.map(p => p.id);
    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
    await reorderPackages(ids);
    load();
  };

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
    setForm({ ...EMPTY_PACKAGE, bundleType: typeFilter || 'normal' });
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

  const filteredPackages = typeFilter
    ? packages.filter(p => p.bundleType === typeFilter)
    : packages;

  const pageTitle = typeFilter === 'normal' ? '📦 الباقات الثابتة'
    : typeFilter === 'flex'   ? '✨ الباقات المرنة'
    : '📦 الباقات';
  const breadcrumb = typeFilter === 'normal' ? 'الباقات / ثابتة'
    : typeFilter === 'flex'   ? 'الباقات / مرنة'
    : 'الباقات / قائمة الباقات';

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{pageTitle}</h2>
          <div className="breadcrumb">{breadcrumb}</div>
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button className="btn btn-outline" onClick={() => setShowCatSection(!showCatSection)}>
            🗂 إدارة التصنيفات
          </button>
          <button className="btn btn-primary" onClick={openAdd}>+ إضافة باقة</button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        {/* ── قسم إدارة التصنيفات ── */}
        {showCatSection && (
          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-header">
              <h3>🗂 التصنيفات</h3>
              <span className="badge badge-teal">{categories.length} تصنيف</span>
            </div>
            <div className="card-body">
              {/* فورم إضافة/تعديل */}
              <div style={{ background:'#f8fafc', borderRadius:10, padding:'14px', marginBottom:16, border:'1px solid #e2e8f0' }}>
                <div style={{ fontWeight:700, marginBottom:10, color:'#1A2F3A' }}>
                  {editCat ? '✏️ تعديل التصنيف' : '+ تصنيف جديد'}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">الاسم بالعربي *</label>
                    <input className="form-control" value={catForm.nameAr}
                      onChange={e=>setCatForm(p=>({...p,nameAr:e.target.value}))}
                      placeholder="مثال: نزول الوزن" />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">الاسم بالإنجليزي *</label>
                    <input className="form-control" value={catForm.nameEn}
                      onChange={e=>setCatForm(p=>({...p,nameEn:e.target.value}))}
                      placeholder="e.g. Weight Loss" />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">الأيقونة</label>
                    <input className="form-control" value={catForm.icon}
                      onChange={e=>setCatForm(p=>({...p,icon:e.target.value}))}
                      placeholder="📦" style={{ fontSize:'1.2rem' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">اللون</label>
                    <input type="color" className="form-control" value={catForm.color}
                      onChange={e=>setCatForm(p=>({...p,color:e.target.value}))}
                      style={{ height:38, cursor:'pointer' }} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveCategory} disabled={savingCat}>
                    {savingCat ? '...' : editCat ? '✅ حفظ التعديل' : '+ إضافة'}
                  </button>
                  {editCat && (
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditCat(null); setCatForm({ nameAr:'', nameEn:'', icon:'📦', color:'#4DC3E8' }); }}>
                      إلغاء
                    </button>
                  )}
                </div>
              </div>

              {/* قائمة التصنيفات */}
              {categories.length === 0 ? (
                <div style={{ textAlign:'center', color:'#94a3b8', padding:'16px' }}>لا يوجد تصنيفات بعد</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[...categories].sort((a,b)=>(a.order||0)-(b.order||0)).map((cat, idx, arr) => {
                    const count = packages.filter(p => p.categoryId === cat.id).length;
                    return (
                      <div key={cat.id} style={{ display:'flex', alignItems:'center', gap:8, background:'white', borderRadius:10, padding:'8px 14px', border:`2px solid ${cat.color}40`, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                        {/* أزرار الترتيب */}
                        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                          <button onClick={() => moveCat(cat, -1)} disabled={idx===0}
                            style={{ background:'none', border:'1px solid #e2e8f0', borderRadius:4, cursor:'pointer', padding:'2px 6px', fontSize:'0.7rem', opacity: idx===0?0.3:1 }}>▲</button>
                          <button onClick={() => moveCat(cat, 1)} disabled={idx===arr.length-1}
                            style={{ background:'none', border:'1px solid #e2e8f0', borderRadius:4, cursor:'pointer', padding:'2px 6px', fontSize:'0.7rem', opacity: idx===arr.length-1?0.3:1 }}>▼</button>
                        </div>
                        <span style={{ fontSize:'1.2rem' }}>{cat.icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:700, fontSize:'0.88rem', color:'#1A2F3A' }}>{cat.nameAr}</div>
                          <div style={{ fontSize:'0.72rem', color:'#94a3b8' }}>{cat.nameEn} · {count} باقة</div>
                        </div>
                        <div style={{ display:'flex', gap:4 }}>
                          <button className="btn btn-ghost btn-sm" style={{ padding:'4px 8px' }}
                            onClick={() => { setEditCat(cat); setCatForm({ nameAr:cat.nameAr, nameEn:cat.nameEn, icon:cat.icon||'📦', color:cat.color||'#4DC3E8' }); }}>
                            ✏️
                          </button>
                          <button className="btn btn-sm" style={{ padding:'4px 8px', background:'#fee2e2', color:'#dc2626', border:'none', cursor:'pointer' }}
                            onClick={() => handleDeleteCat(cat)}>
                            🗑
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── الباقات مجمّعة بالتصنيف ── */}
        {loading ? (
          <div className="loading"><div className="spinner"/>جاري التحميل...</div>
        ) : filteredPackages.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>لا يوجد باقات{typeFilter === 'normal' ? ' ثابتة' : typeFilter === 'flex' ? ' مرنة' : ''}</h3>
              <button className="btn btn-primary" style={{ marginTop:'12px' }} onClick={openAdd}>+ إضافة باقة</button>
            </div>
          </div>
        ) : (
          <>
            {/* باقات بدون تصنيف */}
            {filteredPackages.filter(p => !p.categoryId).length > 0 && (
              <div className="card" style={{ marginBottom:20 }}>
                <div className="card-header">
                  <h3>📦 بدون تصنيف</h3>
                  <span className="badge badge-teal">{filteredPackages.filter(p=>!p.categoryId).length}</span>
                </div>
                <PackagesTable pkgs={filteredPackages.filter(p=>!p.categoryId)} openEdit={openEdit} handleDelete={handleDelete} onMove={movePkg} />
              </div>
            )}
            {/* باقات مجمّعة بالتصنيف */}
            {categories.map(cat => {
              const catPkgs = filteredPackages.filter(p => p.categoryId === cat.id);
              if (catPkgs.length === 0) return null;
              return (
                <div key={cat.id} className="card" style={{ marginBottom:20 }}>
                  <div className="card-header" style={{ borderRight:`4px solid ${cat.color}` }}>
                    <h3>{cat.icon} {cat.nameAr} <span style={{ fontSize:'0.8rem', color:'#94a3b8', fontWeight:400 }}>({cat.nameEn})</span></h3>
                    <span className="badge badge-teal">{catPkgs.length} باقة</span>
                  </div>
                  <PackagesTable pkgs={catPkgs} openEdit={openEdit} handleDelete={handleDelete} onMove={movePkg} />
                </div>
              );
            })}
          </>
        )}
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
                {[
                  { value:'normal', label:'📦 باقة ثابتة (Normal)' },
                  { value:'flex',   label:'✨ باقة مرنة (Flex)'    },
                ].map(opt => {
                  const active = form.bundleType === opt.value;
                  return (
                    <div key={opt.value} className="radio-option" onClick={() => update('bundleType', opt.value)}
                      style={{ cursor:'pointer' }}>
                      <label style={{
                        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                        padding:'10px 16px', fontWeight: active ? 700 : 500,
                        background: active ? 'var(--teal,#0d9488)' : 'transparent',
                        color: active ? 'white' : 'inherit', height:'100%', width:'100%',
                      }}>
                        {opt.label}
                      </label>
                    </div>
                  );
                })}
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
                  <input className="form-control" type="number" min="1" max="10" value={form.mealsNumber}
                    onChange={e => update('mealsNumber', parseInt(e.target.value) || 1)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Snacks Number</label>
                  <input className="form-control" type="number" min="0" max="10" value={form.snacksNumber}
                    onChange={e => update('snacksNumber', parseInt(e.target.value) || 0)} />
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
              <div className="section-title" style={{ marginTop: 8 }}>
                الحد الأقصى لكل نوع وجبة
                <span style={{ fontSize:'0.75rem', fontWeight:400, marginRight:8, color:'#64748b' }}>
                  (المجموع اليومي المسموح = {form.mealsNumber} وجبة)
                </span>
              </div>
              <div className="form-grid" style={{ marginBottom: '16px' }}>
                {[
                  { key:'allowedBreakfast', label:'Allowed Breakfast 🍳' },
                  { key:'allowedLunch',     label:'Allowed Lunch 🍛' },
                  { key:'allowedDinner',    label:'Allowed Dinner 🌙' },
                ].map(({ key, label }) => (
                  <div className="form-group" key={key}>
                    <label className="form-label">{label}</label>
                    <input className="form-control" type="number" min="0" max={form.mealsNumber}
                      value={form[key] || 0}
                      onChange={e => update(key, parseInt(e.target.value) || 0)} />
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Offers Days</label>
                  <input className="form-control" type="number" value={form.offersDays}
                    onChange={e => update('offersDays', parseInt(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">❄️ أقصى أيام تجميد مسموحة</label>
                  <input className="form-control" type="number" min="0" value={form.maxFreezeDays || 0}
                    onChange={e => update('maxFreezeDays', parseInt(e.target.value) || 0)}
                    placeholder="0 = بلا حد" />
                  <div style={{ fontSize:'0.72rem', color:'#94a3b8', marginTop:'4px' }}>0 = بلا حد أقصى</div>
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
                          onChange={e => {
                            const opt = DURATION_OPTIONS.find(d => d.label === e.target.value);
                            updatePrice(i, 'duration', e.target.value);
                            if (opt) {
                              updatePrice(i, 'weeks', opt.weeks);
                              updatePrice(i, 'days',  opt.days);
                            }
                          }}>
                          <option value="">-- اختر المدة --</option>
                          {DURATION_OPTIONS.map(d => <option key={d.label}>{d.label}</option>)}
                        </select>
                        {price.duration === 'مخصص' && (
                          <div style={{ display:'flex', gap:6, marginTop:6 }}>
                            <input className="form-control" type="number" placeholder="أيام" style={{ flex:1 }}
                              value={price.days || ''} onChange={e => updatePrice(i, 'days', Number(e.target.value))} />
                            <input className="form-control" type="number" placeholder="أسابيع" style={{ flex:1 }}
                              value={price.weeks || ''} onChange={e => updatePrice(i, 'weeks', Number(e.target.value))} />
                          </div>
                        )}
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
