import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useLang } from '../LanguageContext';

export default function DeliveryPeriodsPage() {
  const { isAr } = useLang();
  const [periods, setPeriods]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState('');
  const [form, setForm]           = useState({ nameAr:'', nameEn:'', timeFrom:'', timeTo:'', isDefault:false, isActive:true });

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'deliveryPeriods'));
    setPeriods(snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b) => (a.order||0)-(b.order||0)));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditItem(null);
    setForm({ nameAr:'', nameEn:'', timeFrom:'', timeTo:'', isDefault:false, isActive:true });
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditItem(p);
    setForm({ nameAr:p.nameAr||'', nameEn:p.nameEn||'', timeFrom:p.timeFrom||'', timeTo:p.timeTo||'', isDefault:p.isDefault||false, isActive:p.isActive!==false });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.nameAr || !form.nameEn) { setMsg('❌ أدخل الاسم بالعربي والإنجليزي'); return; }
    setSaving(true);
    try {
      if (form.isDefault) {
        // إلغاء الافتراضي من الكل
        for (const p of periods) {
          if (p.id !== editItem?.id && p.isDefault) {
            await updateDoc(doc(db, 'deliveryPeriods', p.id), { isDefault: false });
          }
        }
      }
      if (editItem) {
        await updateDoc(doc(db, 'deliveryPeriods', editItem.id), { ...form, updatedAt: serverTimestamp() });
        setMsg('✅ تم التحديث');
      } else {
        await addDoc(collection(db, 'deliveryPeriods'), { ...form, order: periods.length + 1, createdAt: serverTimestamp() });
        setMsg('✅ تمت الإضافة');
      }
      setShowForm(false);
      load();
    } catch(e) { setMsg('❌ ' + e.message); }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('حذف هذه الفترة؟')) return;
    await deleteDoc(doc(db, 'deliveryPeriods', id));
    load();
  };

  const setDefault = async (period) => {
    for (const p of periods) {
      await updateDoc(doc(db, 'deliveryPeriods', p.id), { isDefault: p.id === period.id });
    }
    load();
    setMsg('✅ تم تحديد الفترة الافتراضية');
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🚚 فترات التوصيل</h2>
          <div className="breadcrumb">التوصيل / فترات التوصيل</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ إضافة فترة</button>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div className="card">
          <div className="card-header">
            <h3>قائمة فترات التوصيل</h3>
            <span className="badge badge-teal">{periods.length} فترة</span>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner"/>جاري التحميل...</div>
          ) : periods.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🚚</div>
              <h3>لا يوجد فترات توصيل</h3>
              <p>أضف فترات التوصيل المتاحة للعملاء</p>
              <button className="btn btn-primary" style={{ marginTop:12 }} onClick={openAdd}>+ إضافة فترة</button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>الاسم بالعربي</th>
                    <th>الاسم بالإنجليزي</th>
                    <th>من</th>
                    <th>إلى</th>
                    <th>الافتراضي</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.nameAr}</strong></td>
                      <td>{p.nameEn}</td>
                      <td>{p.timeFrom || '—'}</td>
                      <td>{p.timeTo || '—'}</td>
                      <td>
                        {p.isDefault
                          ? <span className="badge badge-green">✅ افتراضي</span>
                          : <button className="btn btn-ghost btn-sm" onClick={() => setDefault(p)}>تعيين</button>
                        }
                      </td>
                      <td>
                        <span className={`badge ${p.isActive!==false?'badge-green':'badge-orange'}`}>
                          {p.isActive!==false ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>تعديل</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? '✏️ تعديل فترة' : '+ إضافة فترة توصيل'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className="form-group">
                  <label className="form-label">الاسم بالعربي *</label>
                  <input className="form-control" value={form.nameAr} onChange={e=>setForm(p=>({...p,nameAr:e.target.value}))} placeholder="مثال: صباحي" />
                </div>
                <div className="form-group">
                  <label className="form-label">Name in English *</label>
                  <input className="form-control" value={form.nameEn} onChange={e=>setForm(p=>({...p,nameEn:e.target.value}))} placeholder="e.g. Morning" />
                </div>
                <div className="form-group">
                  <label className="form-label">من (الوقت)</label>
                  <input className="form-control" type="time" value={form.timeFrom} onChange={e=>setForm(p=>({...p,timeFrom:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">إلى (الوقت)</label>
                  <input className="form-control" type="time" value={form.timeTo} onChange={e=>setForm(p=>({...p,timeTo:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                  <input type="checkbox" checked={form.isDefault} onChange={e=>setForm(p=>({...p,isDefault:e.target.checked}))} style={{ accentColor:'#0d9488', width:16, height:16 }} />
                  <span style={{ fontWeight:600 }}>تعيين كفترة افتراضية (تُحدد تلقائياً للعملاء)</span>
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                  <input type="checkbox" checked={form.isActive} onChange={e=>setForm(p=>({...p,isActive:e.target.checked}))} style={{ accentColor:'#0d9488', width:16, height:16 }} />
                  <span style={{ fontWeight:600 }}>الفترة نشطة (تظهر للعملاء)</span>
                </label>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={save} disabled={saving}>
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
