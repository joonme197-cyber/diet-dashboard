import { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase/config';
import {
  collection, getDocs, doc, setDoc, updateDoc,
  deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { MEALS_DATA } from '../firebase/mealService';
import { useLang } from '../LanguageContext';
import * as XLSX from 'xlsx';

const SECTIONS = [
  { key: 'all',    labelAr: 'الكل',    labelEn: 'All',      color: '#0d9488' },
  { key: 'افطار', labelAr: 'الفطور',  labelEn: 'Breakfast', color: '#f59e0b' },
  { key: 'غداء',  labelAr: 'الغداء',  labelEn: 'Lunch',     color: '#7c3aed' },
  { key: 'عشاء',  labelAr: 'العشاء',  labelEn: 'Dinner',    color: '#2563eb' },
  { key: 'سناك',  labelAr: 'السناك',  labelEn: 'Snacks',    color: '#16a34a' },
];

const EMPTY_FORM = {
  mealTitle: '', mealTitleEn: '', mealType: 'افطار',
  protein: '', carbs: '', fats: '', calories: '',
  isActive: true, imageUrl: '',
};

export default function MealsPage() {
  const { isAr } = useLang();
  const [meals, setMeals]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [section, setSection]           = useState('all');
  const [search, setSearch]             = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editMeal, setEditMeal]         = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [importing, setImporting]       = useState(false);
  const [msg, setMsg]                   = useState('');
  const [imageFile, setImageFile]       = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileRef  = useRef();
  const xlsxRef  = useRef();

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'meals'));
    const data = snap.docs.map(d => {
      const item = { id: d.id, ...d.data() };
      return {
        ...item,
        imageUrl: item.imageUrl || item.image || item.photoURL || item.photo || '',
      };
    });
    setMeals(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── فلترة ──
  const filtered = meals.filter(m => {
    const matchSection = section === 'all' || m.mealType === section;
    const matchSearch  = !search ||
      m.mealTitle?.includes(search) ||
      m.mealTitleEn?.toLowerCase().includes(search.toLowerCase());
    return matchSection && matchSearch;
  });

  const countBySection = (key) => key === 'all' ? meals.length : meals.filter(m => m.mealType === key).length;

  // ── رفع الصورة ──
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (mealId) => {
    if (!imageFile) return form.imageUrl || '';
    setUploading(true);
    const storageRef = ref(storage, `meals/${mealId}_${Date.now()}`);
    await uploadBytes(storageRef, imageFile);
    const url = await getDownloadURL(storageRef);
    setUploading(false);
    return url;
  };

  // ── فتح Modal إضافة ──
  const openAdd = () => {
    setEditMeal(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview('');
    setShowModal(true);
  };

  // ── فتح Modal تعديل ──
  const openEdit = (meal) => {
    setEditMeal(meal);
    setForm({
      mealTitle:   meal.mealTitle   || '',
      mealTitleEn: meal.mealTitleEn || '',
      mealType:    meal.mealType    || 'افطار',
      protein:     meal.protein     || '',
      carbs:       meal.carbs       || '',
      fats:        meal.fats        || '',
      calories:    meal.calories    || '',
      isActive:    meal.isActive !== false,
      imageUrl:    meal.imageUrl    || '',
    });
    setImageFile(null);
    setImagePreview(meal.imageUrl || '');
    setShowModal(true);
  };

  // ── حفظ وجبة ──
  const saveMeal = async () => {
    if (!form.mealTitle) return;
    setSaving(true);
    try {
      const mealId = editMeal?.id || `meal_${Date.now()}`;
      const imageUrl = await uploadImage(mealId);
      const data = {
        ...form,
        imageUrl,
        protein:  Number(form.protein)  || 0,
        carbs:    Number(form.carbs)    || 0,
        fats:     Number(form.fats)     || 0,
        calories: Number(form.calories) || 0,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'meals', mealId), data, { merge: true });
      setShowModal(false);
      await load();
      showMsg(isAr ? '✅ تم الحفظ' : '✅ Saved');
    } catch (err) {
      console.error(err);
      showMsg('❌ ' + err.message);
    }
    setSaving(false);
  };

  // ── حذف وجبة ──
  const deleteMeal = async (meal) => {
    if (!window.confirm(isAr ? 'حذف هذه الوجبة؟' : 'Delete this meal?')) return;
    await deleteDoc(doc(db, 'meals', meal.id));
    await load();
    showMsg(isAr ? 'تم الحذف' : 'Deleted');
  };

  // ── تفعيل / تعطيل ──
  const toggleActive = async (meal) => {
    await updateDoc(doc(db, 'meals', meal.id), { isActive: !meal.isActive });
    setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, isActive: !m.isActive } : m));
  };

  // ── رفع من MEALS_DATA (البيانات الثابتة) ──
  const uploadFromData = async () => {
    if (!window.confirm(isAr ? 'رفع 104 وجبة من البيانات الافتراضية؟' : 'Upload 104 meals from default data?')) return;
    setImporting(true);
    let count = 0;
    for (const meal of MEALS_DATA) {
      await setDoc(doc(db, 'meals', meal.id), { ...meal, updatedAt: serverTimestamp() }, { merge: true });
      count++;
    }
    await load();
    setImporting(false);
    showMsg(isAr ? `✅ تم رفع ${count} وجبة` : `✅ Uploaded ${count} meals`);
  };

  // ── استيراد من Excel ──
  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);
        let count  = 0;
        for (const row of rows) {
          const mealId = row['id'] || `meal_${Date.now()}_${count}`;
          await setDoc(doc(db, 'meals', mealId), {
            id:          mealId,
            mealTitle:   row['mealTitle']   || row['name_ar'] || '',
            mealTitleEn: row['mealTitleEn'] || row['name_en'] || '',
            mealType:    row['mealType']    || row['type']    || 'افطار',
            protein:     Number(row['protein'])  || 0,
            carbs:       Number(row['carbs'])    || 0,
            fats:        Number(row['fats'])     || 0,
            calories:    Number(row['calories']) || 0,
            isActive:    true,
            imageUrl:    row['imageUrl'] || row['image'] || row['photoURL'] || row['photo'] || '',
            updatedAt:   serverTimestamp(),
          }, { merge: true });
          count++;
        }
        await load();
        showMsg(isAr ? `✅ تم استيراد ${count} وجبة` : `✅ Imported ${count} meals`);
      } catch (err) {
        showMsg('❌ ' + err.message);
      }
      setImporting(false);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const secLabel = (s) => isAr ? s.labelAr : s.labelEn;
  const secColor = (key) => SECTIONS.find(s => s.key === key)?.color || '#0d9488';

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🍽 {isAr ? 'الوجبات' : 'Meals'}</h2>
          <div className="breadcrumb">
            {filtered.length} {isAr ? 'وجبة' : 'meals'}
            {section !== 'all' && ` — ${secLabel(SECTIONS.find(s=>s.key===section))}`}
          </div>
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <input ref={xlsxRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleExcelImport} />
          <button className="btn btn-ghost" onClick={() => xlsxRef.current.click()} disabled={importing}>
            📂 {isAr ? 'استيراد Excel' : 'Import Excel'}
          </button>
          {meals.length === 0 && (
            <button className="btn btn-outline" onClick={uploadFromData} disabled={importing}>
              ⬆ {isAr ? 'رفع الوجبات الافتراضية' : 'Upload Default Meals'}
            </button>
          )}
          <button className="btn btn-primary" onClick={openAdd}>
            + {isAr ? 'إضافة وجبة' : 'Add Meal'}
          </button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        {/* Stats بالأقسام */}
        <div style={{ display:'flex', gap:'10px', marginBottom:'20px', flexWrap:'wrap' }}>
          {SECTIONS.map(s => (
            <div key={s.key}
              onClick={() => setSection(s.key)}
              style={{
                padding:'10px 20px', borderRadius:'10px', cursor:'pointer',
                background: section===s.key ? s.color : 'white',
                color: section===s.key ? 'white' : '#1e293b',
                border: `2px solid ${section===s.key ? s.color : '#e2e8f0'}`,
                fontWeight:700, fontSize:'0.88rem', transition:'all 0.2s',
                display:'flex', alignItems:'center', gap:'8px',
              }}>
              <span style={{ fontSize:'1.1rem' }}>
                {s.key==='افطار'?'🌅':s.key==='غداء'?'☀️':s.key==='عشاء'?'🌙':s.key==='سناك'?'🥗':'🍽'}
              </span>
              {secLabel(s)}
              <span style={{
                background: section===s.key ? 'rgba(255,255,255,0.3)' : '#f1f5f9',
                color: section===s.key ? 'white' : '#64748b',
                padding:'2px 8px', borderRadius:'999px', fontSize:'0.75rem',
              }}>
                {countBySection(s.key)}
              </span>
            </div>
          ))}
        </div>

        {/* بحث */}
        <div style={{ marginBottom:'16px' }}>
          <input className="form-control" style={{ maxWidth:'320px' }}
            placeholder={isAr ? '🔍 بحث بالاسم...' : '🔍 Search...'}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* شبكة الوجبات */}
        {loading || importing ? (
          <div className="loading"><div className="spinner" />{isAr?'جاري التحميل...':'Loading...'}</div>
        ) : filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">🍽</div>
              <h3>{isAr ? 'لا يوجد وجبات' : 'No meals found'}</h3>
              {meals.length === 0 && (
                <button className="btn btn-primary" style={{ marginTop:'12px' }} onClick={uploadFromData}>
                  ⬆ {isAr ? 'رفع الوجبات الافتراضية' : 'Upload Default Meals'}
                </button>
              )}
            </div>
          </div>
        ) : (
          // تجميع حسب القسم
          (section === 'all' ? ['افطار','غداء','عشاء','سناك'] : [section]).map(sec => {
            const secMeals = filtered.filter(m => m.mealType === sec);
            if (secMeals.length === 0) return null;
            const secObj = SECTIONS.find(s => s.key === sec);
            return (
              <div key={sec} style={{ marginBottom:'28px' }}>
                <div style={{
                  display:'flex', alignItems:'center', gap:'10px',
                  marginBottom:'14px', paddingBottom:'8px',
                  borderBottom:`2px solid ${secObj.color}`,
                }}>
                  <span style={{ fontSize:'1.3rem' }}>
                    {sec==='افطار'?'🌅':sec==='غداء'?'☀️':sec==='عشاء'?'🌙':'🥗'}
                  </span>
                  <h3 style={{ margin:0, color:secObj.color, fontWeight:800 }}>
                    {isAr ? secObj.labelAr : secObj.labelEn}
                  </h3>
                  <span style={{ background:secObj.color+'22', color:secObj.color, padding:'2px 10px', borderRadius:'999px', fontSize:'0.8rem', fontWeight:700 }}>
                    {secMeals.length}
                  </span>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:'14px' }}>
                  {secMeals.map(meal => (
                    <div key={meal.id} style={{
                      background:'white', border:'1px solid #e2e8f0', borderRadius:'12px',
                      overflow:'hidden', transition:'all 0.2s', opacity: meal.isActive ? 1 : 0.55,
                      boxShadow:'0 1px 3px #0000000a',
                    }}
                      onMouseOver={e => e.currentTarget.style.boxShadow='0 4px 12px #0000001a'}
                      onMouseOut={e => e.currentTarget.style.boxShadow='0 1px 3px #0000000a'}>

                      {/* صورة الوجبة */}
                      <div style={{ height:'140px', background:'#f8fafc', position:'relative', overflow:'hidden' }}>
                        {meal.imageUrl ? (
                          <img src={meal.imageUrl} alt={meal.mealTitle}
                            style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        ) : (
                          <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.5rem', color:'#cbd5e1' }}>
                            {sec==='افطار'?'🌅':sec==='غداء'?'☀️':sec==='عشاء'?'🌙':'🥗'}
                          </div>
                        )}
                        {/* badge القسم */}
                        <span style={{
                          position:'absolute', top:'8px', right:'8px',
                          background:secObj.color, color:'white',
                          padding:'2px 8px', borderRadius:'6px', fontSize:'0.7rem', fontWeight:700,
                        }}>
                          {isAr ? secObj.labelAr : secObj.labelEn}
                        </span>
                        {!meal.isActive && (
                          <span style={{ position:'absolute', top:'8px', left:'8px', background:'#ef4444', color:'white', padding:'2px 8px', borderRadius:'6px', fontSize:'0.7rem', fontWeight:700 }}>
                            {isAr?'معطل':'Off'}
                          </span>
                        )}
                      </div>

                      {/* بيانات الوجبة */}
                      <div style={{ padding:'12px' }}>
                        <div style={{ fontWeight:700, fontSize:'0.9rem', marginBottom:'2px' }}>{meal.mealTitle}</div>
                        <div style={{ fontSize:'0.75rem', color:'#94a3b8', marginBottom:'8px' }}>{meal.mealTitleEn}</div>

                        {/* السعرات والماكرو */}
                        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'10px' }}>
                          <span style={{ background:'#fef3c7', color:'#d97706', padding:'2px 7px', borderRadius:'6px', fontSize:'0.72rem', fontWeight:700 }}>
                            🔥 {meal.calories} cal
                          </span>
                          <span style={{ background:'#dbeafe', color:'#1d4ed8', padding:'2px 7px', borderRadius:'6px', fontSize:'0.72rem', fontWeight:700 }}>
                            P {meal.protein}g
                          </span>
                          <span style={{ background:'#dcfce7', color:'#16a34a', padding:'2px 7px', borderRadius:'6px', fontSize:'0.72rem', fontWeight:700 }}>
                            C {meal.carbs}g
                          </span>
                          <span style={{ background:'#fce7f3', color:'#be185d', padding:'2px 7px', borderRadius:'6px', fontSize:'0.72rem', fontWeight:700 }}>
                            F {meal.fats}g
                          </span>
                        </div>

                        {/* أزرار */}
                        <div style={{ display:'flex', gap:'6px' }}>
                          <button onClick={() => openEdit(meal)}
                            style={{ flex:1, background:'#f0fdfa', border:'1px solid #ccfbf1', color:'#0d9488', borderRadius:'6px', padding:'5px', cursor:'pointer', fontSize:'0.8rem', fontWeight:600 }}>
                            ✏️ {isAr?'تعديل':'Edit'}
                          </button>
                          <button onClick={() => toggleActive(meal)}
                            style={{ background:'none', border:'1px solid #e2e8f0', borderRadius:'6px', padding:'5px 8px', cursor:'pointer', fontSize:'0.85rem' }}>
                            {meal.isActive ? '🟢' : '🔴'}
                          </button>
                          <button onClick={() => deleteMeal(meal)}
                            style={{ background:'#fee2e2', border:'1px solid #fecaca', color:'#ef4444', borderRadius:'6px', padding:'5px 8px', cursor:'pointer', fontSize:'0.8rem' }}>
                            🗑
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Modal: إضافة / تعديل ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:'560px' }}>
            <div className="modal-header">
              <h3>{editMeal ? (isAr?'تعديل وجبة':'Edit Meal') : (isAr?'إضافة وجبة':'Add Meal')}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">

                {/* صورة الوجبة */}
                <div className="form-group full-width">
                  <label className="form-label">📸 {isAr?'صورة الوجبة':'Meal Image'}</label>
                  <div style={{ display:'flex', gap:'14px', alignItems:'center' }}>
                    <div style={{ width:'90px', height:'90px', borderRadius:'10px', overflow:'hidden', background:'#f8fafc', border:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {imagePreview
                        ? <img src={imagePreview} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : <span style={{ fontSize:'2rem', color:'#cbd5e1' }}>🍽</span>}
                    </div>
                    <div>
                      <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImageChange} />
                      <button className="btn btn-outline btn-sm" onClick={() => fileRef.current.click()}>
                        {isAr?'اختر صورة':'Choose Image'}
                      </button>
                      {imagePreview && (
                        <button className="btn btn-ghost btn-sm" style={{ marginTop:'6px' }}
                          onClick={() => { setImageFile(null); setImagePreview(''); setForm(p=>({...p,imageUrl:''})); }}>
                          {isAr?'إزالة':'Remove'}
                        </button>
                      )}
                      <div style={{ fontSize:'0.72rem', color:'#94a3b8', marginTop:'4px' }}>
                        {isAr?'JPG, PNG, WEBP — بيتحفظ في Firebase Storage':'JPG, PNG, WEBP'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{isAr?'الاسم بالعربي':'Arabic Name'} <span className="required">*</span></label>
                  <input className="form-control" value={form.mealTitle}
                    onChange={e => setForm(p=>({...p,mealTitle:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{isAr?'الاسم بالإنجليزي':'English Name'}</label>
                  <input className="form-control" value={form.mealTitleEn}
                    onChange={e => setForm(p=>({...p,mealTitleEn:e.target.value}))} />
                </div>

                <div className="form-group full-width">
                  <label className="form-label">{isAr?'القسم':'Section'}</label>
                  <div className="radio-group">
                    {[{key:'افطار',ar:'فطور',en:'Breakfast'},{key:'غداء',ar:'غداء',en:'Lunch'},{key:'عشاء',ar:'عشاء',en:'Dinner'},{key:'سناك',ar:'سناك',en:'Snacks'}].map(t=>(
                      <div key={t.key} className="radio-option">
                        <input type="radio" id={`type_${t.key}`} checked={form.mealType===t.key}
                          onChange={() => setForm(p=>({...p,mealType:t.key}))} />
                        <label htmlFor={`type_${t.key}`}>{isAr?t.ar:t.en}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">🔥 {isAr?'السعرات':'Calories'}</label>
                  <input className="form-control" type="number" value={form.calories}
                    onChange={e => setForm(p=>({...p,calories:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">💪 {isAr?'بروتين (g)':'Protein (g)'}</label>
                  <input className="form-control" type="number" value={form.protein}
                    onChange={e => setForm(p=>({...p,protein:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">🌾 {isAr?'كارب (g)':'Carbs (g)'}</label>
                  <input className="form-control" type="number" value={form.carbs}
                    onChange={e => setForm(p=>({...p,carbs:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">🫒 {isAr?'دهون (g)':'Fats (g)'}</label>
                  <input className="form-control" type="number" value={form.fats}
                    onChange={e => setForm(p=>({...p,fats:e.target.value}))} />
                </div>

                <div className="form-group full-width">
                  <label style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer' }}>
                    <input type="checkbox" checked={form.isActive}
                      onChange={e => setForm(p=>({...p,isActive:e.target.checked}))}
                      style={{ accentColor:'#0d9488', width:'16px', height:'16px' }} />
                    <span style={{ fontWeight:600, fontSize:'0.88rem' }}>
                      {isAr?'الوجبة نشطة (تظهر في المنيو)':'Active (visible in menu)'}
                    </span>
                  </label>
                </div>

                <div className="form-group full-width">
                  <button className="btn btn-primary btn-full" onClick={saveMeal}
                    disabled={saving || uploading || !form.mealTitle}>
                    {saving || uploading
                      ? <><div className="spinner" style={{width:'16px',height:'16px',borderWidth:'2px'}}/> {isAr?'جاري الحفظ...':'Saving...'}</>
                      : `✅ ${isAr?'حفظ الوجبة':'Save Meal'}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
