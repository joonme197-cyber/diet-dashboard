import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useLang } from '../LanguageContext';

const MEAL_TYPES = [
  { key:'افطار', ar:'فطور',  en:'Breakfast', icon:'🌅' },
  { key:'غداء',  ar:'غداء',  en:'Lunch',     icon:'☀️' },
  { key:'عشاء',  ar:'عشاء',  en:'Dinner',    icon:'🌙' },
  { key:'سناك',  ar:'سناك',  en:'Snacks',    icon:'🥗' },
];

export default function MealCategoriesPage() {
  const { isAr } = useLang();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState('');
  const [form, setForm]             = useState({ nameAr:'', nameEn:'', mealType:'افطار', icon:'🍽', color:'#4DC3E8' });

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'mealCategories'), orderBy('createdAt', 'asc')));
      setCategories(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    } catch {
      const snap = await getDocs(collection(db, 'mealCategories'));
      setCategories(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditItem(null);
    setForm({ nameAr:'', nameEn:'', mealType:'افطار', icon:'🍽', color:'#4DC3E8' });
    setShowForm(true);
  };

  const openEdit = (cat) => {
    setEditItem(cat);
    setForm({ nameAr:cat.nameAr||'', nameEn:cat.nameEn||'', mealType:cat.mealType||'افطار', icon:cat.icon||'🍽', color:cat.color||'#4DC3E8' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nameAr || !form.nameEn) { setMsg('❌ أدخل الاسم بالعربي والإنجليزي'); return; }
    setSaving(true);
    if (editItem) {
      await updateDoc(doc(db, 'mealCategories', editItem.id), { ...form, updatedAt: serverTimestamp() });
      setMsg('✅ تم التعديل');
    } else {
      await addDoc(collection(db, 'mealCategories'), { ...form, createdAt: serverTimestamp() });
      setMsg('✅ تمت الإضافة');
    }
    setSaving(false);
    setShowForm(false);
    load();
    setTimeout(() => setMsg(''), 2500);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('حذف هذا التصنيف؟')) return;
    await deleteDoc(doc(db, 'mealCategories', id));
    load();
  };

  const getMealTypeLabel = (key) => MEAL_TYPES.find(t => t.key === key);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🍽 تصنيفات الوجبات</h2>
          <div className="breadcrumb">المنيو / تصنيفات الوجبات</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ إضافة تصنيف</button>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div className="card">
          <div className="card-header">
            <h3>قائمة تصنيفات الوجبات</h3>
            <span className="badge badge-teal">{categories.length} تصنيف</span>
          </div>
          <div className="table-wrapper">
            {loading ? (
              <div className="loading"><div className="spinner"/>جاري التحميل...</div>
            ) : categories.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🍽</div>
                <h3>لا يوجد تصنيفات وجبات</h3>
                <button className="btn btn-primary" style={{ marginTop:12 }} onClick={openAdd}>+ إضافة تصنيف</button>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>الأيقونة</th>
                    <th>الاسم بالعربي</th>
                    <th>الاسم بالإنجليزي</th>
                    <th>نوع الوجبة</th>
                    <th>اللون</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat, i) => {
                    const mt = getMealTypeLabel(cat.mealType);
                    return (
                      <tr key={cat.id}>
                        <td style={{ color:'#94a3b8' }}>{i+1}</td>
                        <td style={{ fontSize:'1.4rem' }}>{cat.icon}</td>
                        <td><strong>{cat.nameAr}</strong></td>
                        <td>{cat.nameEn}</td>
                        <td>
                          <span className="badge badge-teal">
                            {mt?.icon} {isAr ? mt?.ar : mt?.en}
                          </span>
                        </td>
                        <td>
                          <div style={{ width:24, height:24, borderRadius:6, background:cat.color||'#4DC3E8', border:'1px solid #e2e8f0' }} />
                        </td>
                        <td>
                          <div style={{ display:'flex', gap:6 }}>
                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(cat)}>تعديل</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cat.id)}>حذف</button>
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

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? '✏️ تعديل تصنيف' : '+ إضافة تصنيف وجبات'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className="form-group">
                  <label className="form-label">الاسم بالعربي *</label>
                  <input className="form-control" value={form.nameAr} onChange={e=>setForm(p=>({...p,nameAr:e.target.value}))} placeholder="مثال: صدور دجاج" />
                </div>
                <div className="form-group">
                  <label className="form-label">Name in English *</label>
                  <input className="form-control" value={form.nameEn} onChange={e=>setForm(p=>({...p,nameEn:e.target.value}))} placeholder="e.g. Chicken Breast" />
                </div>
                <div className="form-group">
                  <label className="form-label">نوع الوجبة</label>
                  <select className="form-control" value={form.mealType} onChange={e=>setForm(p=>({...p,mealType:e.target.value}))}>
                    {MEAL_TYPES.map(t => (
                      <option key={t.key} value={t.key}>{t.icon} {t.ar}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">الأيقونة</label>
                  <input className="form-control" value={form.icon} onChange={e=>setForm(p=>({...p,icon:e.target.value}))} placeholder="🍽" style={{ fontSize:'1.2rem' }} />
                </div>
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">اللون</label>
                  <input type="color" className="form-control" value={form.color} onChange={e=>setForm(p=>({...p,color:e.target.value}))} style={{ height:40, cursor:'pointer' }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:8 }}>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={handleSave} disabled={saving}>
                  {saving ? '...' : editItem ? '✅ حفظ التعديل' : '+ إضافة'}
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
