import { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useLang } from '../LanguageContext';

export default function SlidesPage() {
  const { isAr } = useLang();
  const [slides, setSlides]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg]           = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editSlide, setEditSlide] = useState(null);
  const [form, setForm]         = useState({ titleAr:'', titleEn:'', subAr:'', subEn:'', link:'', isActive:true });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileRef = useRef();

  const showMsg = (m) => { setMsg(m); setTimeout(()=>setMsg(''), 3000); };

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(query(collection(db, 'slides'), orderBy('order', 'asc')));
    setSlides(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditSlide(null);
    setForm({ titleAr:'', titleEn:'', subAr:'', subEn:'', link:'', isActive:true });
    setImageFile(null); setImagePreview('');
    setShowForm(true);
  };

  const openEdit = (slide) => {
    setEditSlide(slide);
    setForm({ titleAr: slide.titleAr||'', titleEn: slide.titleEn||'', subAr: slide.subAr||'', subEn: slide.subEn||'', link: slide.link||'', isActive: slide.isActive !== false });
    setImagePreview(slide.imageUrl || '');
    setImageFile(null);
    setShowForm(true);
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (slideId) => {
    if (!imageFile) return editSlide?.imageUrl || '';
    setUploading(true);
    const storageRef = ref(storage, `slides/${slideId}_${Date.now()}`);
    await uploadBytes(storageRef, imageFile);
    const url = await getDownloadURL(storageRef);
    setUploading(false);
    return url;
  };

  const save = async () => {
    setSaving(true);
    try {
      const maxOrder = slides.length > 0 ? Math.max(...slides.map(s => s.order||0)) : 0;
      if (editSlide) {
        const imageUrl = await uploadImage(editSlide.id);
        await updateDoc(doc(db, 'slides', editSlide.id), { ...form, imageUrl, updatedAt: serverTimestamp() });
        showMsg('✅ تم تحديث السلايد');
      } else {
        const docRef = await addDoc(collection(db, 'slides'), { ...form, imageUrl:'', order: maxOrder+1, createdAt: serverTimestamp() });
        const imageUrl = await uploadImage(docRef.id);
        if (imageUrl) await updateDoc(doc(db, 'slides', docRef.id), { imageUrl });
        showMsg('✅ تم إضافة السلايد');
      }
      setShowForm(false);
      load();
    } catch(e) { showMsg('❌ ' + e.message); }
    setSaving(false);
  };

  const handleDelete = async (slide) => {
    if (!window.confirm('حذف هذا السلايد؟')) return;
    if (slide.imageUrl) {
      try { await deleteObject(ref(storage, slide.imageUrl)); } catch {}
    }
    await deleteDoc(doc(db, 'slides', slide.id));
    showMsg('✅ تم الحذف');
    load();
  };

  const toggleActive = async (slide) => {
    await updateDoc(doc(db, 'slides', slide.id), { isActive: !slide.isActive });
    load();
  };

  const move = async (slide, dir) => {
    const sorted = [...slides].sort((a,b)=>(a.order||0)-(b.order||0));
    const idx    = sorted.findIndex(s => s.id === slide.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'slides', sorted[idx].id),     { order: swapIdx + 1 });
    batch.update(doc(db, 'slides', sorted[swapIdx].id), { order: idx + 1 });
    await batch.commit();
    load();
  };

  const update = (k,v) => setForm(p=>({...p,[k]:v}));

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🖼 {isAr ? 'إدارة السلايدر' : 'Slider Management'}</h2>
          <div className="breadcrumb">{isAr ? 'صور وعروض الصفحة الرئيسية' : 'Home page banners & promotions'}</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ {isAr?'إضافة سلايد':'Add Slide'}</button>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        {loading ? (
          <div className="loading"><div className="spinner"/>جاري التحميل...</div>
        ) : slides.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">🖼</div>
              <h3>{isAr?'لا يوجد سلايدات':'No slides yet'}</h3>
              <button className="btn btn-primary" style={{ marginTop:12 }} onClick={openAdd}>+ {isAr?'إضافة سلايد':'Add Slide'}</button>
            </div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
            {[...slides].sort((a,b)=>(a.order||0)-(b.order||0)).map((slide, idx, arr) => (
              <div key={slide.id} className="card" style={{ overflow:'hidden', opacity: slide.isActive===false ? 0.6 : 1 }}>
                {/* صورة */}
                <div style={{ position:'relative', height:140, background:'linear-gradient(135deg,#4DC3E8,#2BA8D4)', overflow:'hidden' }}>
                  {slide.imageUrl
                    ? <img src={slide.imageUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', fontSize:'3rem' }}>🖼</div>
                  }
                  {/* ترتيب */}
                  <div style={{ position:'absolute', top:8, right:8, display:'flex', flexDirection:'column', gap:4 }}>
                    <button onClick={()=>move(slide,-1)} disabled={idx===0}
                      style={{ background:'rgba(0,0,0,0.5)', color:'white', border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer', opacity:idx===0?0.3:1 }}>▲</button>
                    <button onClick={()=>move(slide,1)} disabled={idx===arr.length-1}
                      style={{ background:'rgba(0,0,0,0.5)', color:'white', border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer', opacity:idx===arr.length-1?0.3:1 }}>▼</button>
                  </div>
                  {/* حالة */}
                  <div style={{ position:'absolute', top:8, left:8 }}>
                    <span className={`badge ${slide.isActive!==false?'badge-green':'badge-orange'}`}>
                      {slide.isActive!==false ? (isAr?'نشط':'Active') : (isAr?'مخفي':'Hidden')}
                    </span>
                  </div>
                  {/* رقم الترتيب */}
                  <div style={{ position:'absolute', bottom:8, right:8, background:'rgba(0,0,0,0.5)', color:'white', borderRadius:6, padding:'2px 8px', fontSize:'0.72rem', fontWeight:700 }}>
                    #{idx+1}
                  </div>
                </div>

                <div style={{ padding:'12px' }}>
                  <div style={{ fontWeight:800, fontSize:'0.95rem', color:'#1A2F3A', marginBottom:2 }}>
                    {slide.titleAr || slide.titleEn || (isAr?'بدون عنوان':'No title')}
                  </div>
                  {slide.titleEn && slide.titleAr && (
                    <div style={{ fontSize:'0.75rem', color:'#94a3b8', marginBottom:6 }}>{slide.titleEn}</div>
                  )}
                  {slide.subAr && (
                    <div style={{ fontSize:'0.78rem', color:'#64748b', marginBottom:8 }}>{slide.subAr}</div>
                  )}

                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <button className="btn btn-outline btn-sm" onClick={()=>openEdit(slide)}>✏️ {isAr?'تعديل':'Edit'}</button>
                    <button className="btn btn-sm" style={{ background: slide.isActive!==false?'#fff7ed':'#f0fdf4', color: slide.isActive!==false?'#d97706':'#16a34a', border:`1px solid ${slide.isActive!==false?'#fde68a':'#bbf7d0'}`, cursor:'pointer', fontFamily:'var(--font-main)', fontWeight:700, padding:'6px 12px', borderRadius:'6px' }}
                      onClick={()=>toggleActive(slide)}>
                      {slide.isActive!==false ? (isAr?'إخفاء':'Hide') : (isAr?'إظهار':'Show')}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(slide)}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="modal" style={{ maxWidth:550 }} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editSlide ? (isAr?'تعديل سلايد':'Edit Slide') : (isAr?'إضافة سلايد':'Add Slide')}</h3>
              <button className="modal-close" onClick={()=>setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">

              {/* رفع صورة */}
              <div className="form-group">
                <label className="form-label">🖼 {isAr?'صورة السلايد':'Slide Image'}</label>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImage} />
                {imagePreview ? (
                  <div style={{ position:'relative', borderRadius:10, overflow:'hidden', marginBottom:8 }}>
                    <img src={imagePreview} alt="" style={{ width:'100%', height:160, objectFit:'cover', display:'block' }} />
                    <button onClick={()=>{ setImageFile(null); setImagePreview(''); }}
                      style={{ position:'absolute', top:8, left:8, background:'rgba(220,38,38,0.85)', color:'white', border:'none', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontWeight:700 }}>✕</button>
                    <button onClick={()=>fileRef.current.click()}
                      style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.6)', color:'white', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontWeight:700, fontSize:'0.8rem' }}>
                      {isAr?'تغيير':'Change'}
                    </button>
                  </div>
                ) : (
                  <div onClick={()=>fileRef.current.click()}
                    style={{ border:'2px dashed #CCE9F5', borderRadius:10, padding:'32px', textAlign:'center', cursor:'pointer', background:'#F0FAFD', transition:'all 0.2s' }}>
                    <div style={{ fontSize:'2rem', marginBottom:8 }}>📁</div>
                    <div style={{ color:'#4DC3E8', fontWeight:700 }}>{isAr?'اضغط لرفع صورة':'Click to upload image'}</div>
                    <div style={{ color:'#94a3b8', fontSize:'0.75rem', marginTop:4 }}>JPG, PNG, WebP</div>
                  </div>
                )}
              </div>

              {/* العنوان */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className="form-group">
                  <label className="form-label">العنوان بالعربي</label>
                  <input className="form-control" value={form.titleAr} onChange={e=>update('titleAr',e.target.value)} placeholder="عنوان السلايد" />
                </div>
                <div className="form-group">
                  <label className="form-label">Title in English</label>
                  <input className="form-control" value={form.titleEn} onChange={e=>update('titleEn',e.target.value)} placeholder="Slide title" />
                </div>
                <div className="form-group">
                  <label className="form-label">النص الفرعي بالعربي</label>
                  <input className="form-control" value={form.subAr} onChange={e=>update('subAr',e.target.value)} placeholder="نص إضافي (اختياري)" />
                </div>
                <div className="form-group">
                  <label className="form-label">Subtitle in English</label>
                  <input className="form-control" value={form.subEn} onChange={e=>update('subEn',e.target.value)} placeholder="Optional subtitle" />
                </div>
              </div>

              {/* رابط */}
              <div className="form-group">
                <label className="form-label">🔗 {isAr?'رابط عند الضغط (اختياري)':'Link on click (optional)'}</label>
                <input className="form-control" value={form.link} onChange={e=>update('link',e.target.value)} placeholder="https://..." />
              </div>

              {/* نشط */}
              <div className="form-group">
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                  <input type="checkbox" checked={form.isActive} onChange={e=>update('isActive',e.target.checked)}
                    style={{ accentColor:'#0d9488', width:16, height:16 }} />
                  <span style={{ fontWeight:600 }}>{isAr?'السلايد نشط (يظهر في الموقع)':'Slide is active (visible on website)'}</span>
                </label>
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={save} disabled={saving||uploading}>
                  {saving||uploading ? <><div className="spinner" style={{width:16,height:16,borderWidth:2}}/> {isAr?'جاري الحفظ...':'Saving...'}</> : (isAr?'✅ حفظ':'✅ Save')}
                </button>
                <button className="btn btn-ghost" onClick={()=>setShowForm(false)}>{isAr?'إلغاء':'Cancel'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
