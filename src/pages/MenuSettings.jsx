import { useState, useEffect, useRef } from 'react';
import {
  CYCLE_DAYS,
  saveMenuDay, getFullMenu,
  getMenus, addMenu, updateMenu, deleteMenu, activateMenu,
  uploadMealsToFirebase, importMenuFromExcel, generateMenuSampleExcel
} from '../firebase/mealService';
import { db } from '../firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const MENU_TYPES = [
  { key: 'default', label: '📋 المنيو الرئيسي', color: '#0d9488', desc: 'يختار منه العميل' },
  { key: 'chef',    label: '👨‍🍳 منيو الشيف',   color: '#7c3aed', desc: 'الاختيار التلقائي' },
];

const MEAL_TYPES = ['افطار','غداء','عشاء','سناك'];
const MEAL_ICONS = { افطار: '🍳', غداء: '🍛', عشاء: '🌙', سناك: '🥗' };

export default function MenuSettings() {
  const [menus, setMenus]           = useState([]);
  const [allMeals, setAllMeals]     = useState([]); // من Firestore
  const [activeMenuId, setActiveMenuId] = useState('default');
  const [menuType, setMenuType]     = useState('default');
  const [selectedDay, setSelectedDay] = useState(CYCLE_DAYS[0].key);
  const [menuData, setMenuData]     = useState({});
  const [selectedMeals, setSelectedMeals] = useState([]);
  const [search, setSearch]         = useState('');
  const [filterType, setFilterType] = useState('الكل');
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [msg, setMsg]               = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editMenu, setEditMenu]     = useState(null);
  const [menuForm, setMenuForm]     = useState({ nameAr:'', nameEn:'', descAr:'', descEn:'' });
  const [savingMenu, setSavingMenu] = useState(false);
  const [activating, setActivating] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const excelFileRef = useRef();

  useEffect(() => {
    loadMenus();
    // جلب الوجبات من Firestore
    getDocs(query(collection(db, 'meals'), orderBy('mealType', 'asc')))
      .then(snap => setAllMeals(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setAllMeals([]));
  }, []);
  useEffect(() => { loadMenu(); }, [activeMenuId, menuType]);

  const loadMenus = async () => {
    const data = await getMenus();
    setMenus(data);
    // لو مفيش منيوات، ابدأ بالـ default
    if (data.length > 0) {
      const active = data.find(m => m.isActive) || data[0];
      setActiveMenuId(active.id);
    }
  };

  const loadMenu = async () => {
    const data = await getFullMenu(menuType, activeMenuId);
    setMenuData(data);
  };

  const openDay = (dayKey) => {
    setSelectedDay(dayKey);
    setSelectedMeals(menuData[dayKey] || []);
    setSearch(''); setFilterType('الكل');
    setShowModal(true);
  };

  const toggleMeal = (mealId) =>
    setSelectedMeals(p => p.includes(mealId) ? p.filter(x=>x!==mealId) : [...p, mealId]);

  const saveDay = async () => {
    setSaving(true);
    await saveMenuDay(menuType, selectedDay, selectedMeals, activeMenuId);
    setMenuData(p => ({ ...p, [selectedDay]: selectedMeals }));
    setSaving(false);
    setMsg('✅ تم الحفظ!');
    setTimeout(() => { setMsg(''); setShowModal(false); }, 1500);
  };

  const handleActivate = async (menuId) => {
    if (!window.confirm('تفعيل هذا المنيو وإيقاف الباقية؟')) return;
    setActivating(true);
    await activateMenu(menuId);
    setMsg('✅ تم تفعيل المنيو — العملاء سيرون هذا المنيو الآن');
    loadMenus();
    setActivating(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const saveMenu = async () => {
    if (!menuForm.nameAr || !menuForm.nameEn) { setMsg('❌ أدخل الاسم بالعربي والإنجليزي'); return; }
    setSavingMenu(true);
    if (editMenu) {
      await updateMenu(editMenu.id, menuForm);
      setMsg('✅ تم تحديث المنيو');
    } else {
      await addMenu({ ...menuForm, isActive: false });
      setMsg('✅ تم إضافة المنيو');
    }
    setShowMenuForm(false);
    setEditMenu(null);
    setMenuForm({ nameAr:'', nameEn:'', descAr:'', descEn:'' });
    loadMenus();
    setSavingMenu(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleDeleteMenu = async (menu) => {
    if (menu.isActive) { setMsg('❌ لا يمكن حذف المنيو النشط'); return; }
    if (!window.confirm(`حذف منيو "${menu.nameAr}"؟`)) return;
    await deleteMenu(menu.id);
    setMsg('✅ تم الحذف');
    loadMenus();
    if (activeMenuId === menu.id) setActiveMenuId(menus.find(m=>m.id!==menu.id)?.id || 'default');
  };

  // ── تحميل ملف السامبل ──
  const handleDownloadSample = async () => {
    setMsg('⏳ جاري إنشاء ملف السامبل...');
    try {
      await generateMenuSampleExcel(allMeals);
      setMsg('✅ تم تحميل ملف السامبل — افتحه واملأ الوجبات ثم ارفعه');
      setTimeout(() => setMsg(''), 5000);
    } catch (e) {
      setMsg('❌ خطأ في إنشاء السامبل: ' + e.message);
    }
  };

  // ── رفع ملف Excel ──
  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm(`رفع ملف "${file.name}" للمنيو ${menuType === 'default' ? 'الأساسي' : 'الشيف'}؟\n\nسيتم تحديث الأيام الموجودة في الملف فقط.`)) {
      excelFileRef.current.value = '';
      return;
    }
    setImportingExcel(true);
    setMsg('⏳ جاري رفع المنيو من Excel...');
    try {
      const result = await importMenuFromExcel(file, menuType, activeMenuId, allMeals);
      let msgText = `✅ تم رفع ${result.savedDays} يوم بنجاح!`;
      if (result.skippedMeals.length > 0) {
        const skippedNames = [...new Set(result.skippedMeals.map(s => s.meal))];
        msgText += `\n\n⚠️ ${result.skippedMeals.length} وجبة لم يتم التعرف عليها:\n${skippedNames.slice(0, 10).join('، ')}${skippedNames.length > 10 ? '...' : ''}`;
      }
      setMsg(msgText);
      loadMenu(); // إعادة تحميل المنيو
      setTimeout(() => setMsg(''), 8000);
    } catch (err) {
      setMsg('❌ خطأ في رفع الملف: ' + err.message);
    }
    setImportingExcel(false);
    excelFileRef.current.value = '';
  };

  const filteredMeals = allMeals.filter(m => {
    const matchSearch = (m.mealTitle||'').includes(search) ||
      (m.mealTitleEn||'').toLowerCase().includes(search.toLowerCase());
    const matchType   = filterType === 'الكل' || m.mealType === filterType;
    return matchSearch && matchType;
  });

  const selectedDayLabel = CYCLE_DAYS.find(d => d.key === selectedDay)?.label || '';
  const activeMenuData   = menus.find(m => m.id === activeMenuId);

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <h2>📋 إعدادات المنيو</h2>
          <div className="breadcrumb">دورة 4 أسابيع — 28 يوم</div>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button className="btn btn-outline" onClick={() => { setShowMenuForm(true); setEditMenu(null); setMenuForm({nameAr:'',nameEn:'',descAr:'',descEn:''}); }}>
            + إضافة منيو
          </button>
          <button className="btn btn-outline" onClick={async()=>{ setUploading(true); const c=await uploadMealsToFirebase(); setUploading(false); setMsg(`✅ تم رفع ${c} وجبة`); setTimeout(()=>setMsg(''),3000); }} disabled={uploading}>
            {uploading ? '⏳...' : '☁️ رفع الوجبات'}
          </button>
          <button className="btn btn-outline" style={{ color:'#16a34a', borderColor:'#16a34a' }} onClick={handleDownloadSample}>
            📥 تحميل سامبل Excel
          </button>
          <button className="btn btn-primary" style={{ background:'#7c3aed' }} onClick={() => excelFileRef.current?.click()} disabled={importingExcel}>
            {importingExcel ? '⏳ جاري الرفع...' : '📤 رفع منيو من Excel'}
          </button>
          <input ref={excelFileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleImportExcel} />
        </div>
      </div>

      {msg && <div style={{ margin:'0 32px 12px' }}><div className={`alert ${msg.includes('❌') ? 'alert-error' : 'alert-success'}`} style={{ whiteSpace:'pre-wrap' }}>{msg}</div></div>}

      <div className="page-body">

        {/* ── قائمة المنيوات ── */}
        <div className="card" style={{ marginBottom:20 }}>
          <div className="card-header">
            <h3>📚 المنيوات المتاحة</h3>
            <span className="badge badge-teal">{menus.length} منيو</span>
          </div>
          <div className="card-body">
            <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>

              {/* المنيو الافتراضي القديم */}
              <div onClick={() => setActiveMenuId('default')}
                style={{ padding:'14px 20px', borderRadius:12, cursor:'pointer', border:`2px solid ${activeMenuId==='default'?'#0d9488':'#e2e8f0'}`,
                  background: activeMenuId==='default'?'#f0fdfa':'white', minWidth:180, transition:'all 0.2s' }}>
                <div style={{ fontWeight:800, color: activeMenuId==='default'?'#0d9488':'#1A2F3A' }}>📋 المنيو الافتراضي</div>
                <div style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:4 }}>Default Menu (القديم)</div>
              </div>

              {menus.map(menu => (
                <div key={menu.id}
                  onClick={() => setActiveMenuId(menu.id)}
                  style={{ padding:'14px 20px', borderRadius:12, cursor:'pointer', border:`2px solid ${activeMenuId===menu.id?'#0d9488':menu.isActive?'#f59e0b':'#e2e8f0'}`,
                    background: activeMenuId===menu.id?'#f0fdfa': menu.isActive?'#fffbeb':'white', minWidth:180, transition:'all 0.2s', position:'relative' }}>
                  {menu.isActive && (
                    <div style={{ position:'absolute', top:-8, right:8, background:'#16a34a', color:'white', fontSize:'0.65rem', fontWeight:700, borderRadius:999, padding:'2px 8px' }}>
                      ✅ نشط الآن
                    </div>
                  )}
                  <div style={{ fontWeight:800, color: activeMenuId===menu.id?'#0d9488':'#1A2F3A' }}>
                    {menu.nameAr}
                  </div>
                  <div style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:2 }}>{menu.nameEn}</div>
                  {menu.descAr && <div style={{ fontSize:'0.72rem', color:'#64748b', marginTop:4 }}>{menu.descAr}</div>}

                  <div style={{ display:'flex', gap:6, marginTop:10 }} onClick={e=>e.stopPropagation()}>
                    {!menu.isActive && (
                      <button className="btn btn-sm" style={{ background:'#16a34a', color:'white', border:'none', cursor:'pointer', fontFamily:'var(--font-main)', fontWeight:700, padding:'4px 10px', borderRadius:6, fontSize:'0.75rem' }}
                        onClick={()=>handleActivate(menu.id)} disabled={activating}>
                        ✅ تفعيل
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ padding:'4px 8px', fontSize:'0.75rem' }}
                      onClick={()=>{ setEditMenu(menu); setMenuForm({nameAr:menu.nameAr,nameEn:menu.nameEn,descAr:menu.descAr||'',descEn:menu.descEn||''}); setShowMenuForm(true); }}>
                      ✏️
                    </button>
                    {!menu.isActive && (
                      <button className="btn btn-sm" style={{ background:'#fee2e2', color:'#dc2626', border:'none', cursor:'pointer', fontFamily:'var(--font-main)', fontWeight:700, padding:'4px 8px', borderRadius:6, fontSize:'0.75rem' }}
                        onClick={()=>handleDeleteMenu(menu)}>
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── تبويبات نوع المنيو ── */}
        <div style={{ display:'flex', gap:12, marginBottom:20 }}>
          {MENU_TYPES.map(m => (
            <button key={m.key} onClick={() => setMenuType(m.key)}
              style={{ padding:'12px 24px', borderRadius:10, border:'none', cursor:'pointer',
                fontFamily:'var(--font-main)', fontWeight:700, fontSize:'0.95rem', transition:'all 0.2s',
                background: menuType===m.key ? m.color : 'white',
                color: menuType===m.key ? 'white' : '#64748b',
                boxShadow: menuType===m.key ? `0 4px 12px ${m.color}40` : '0 1px 3px rgba(0,0,0,0.08)',
                border: menuType===m.key ? 'none' : '1.5px solid #e2e8f0',
              }}>
              {m.label}
              <div style={{ fontSize:'0.72rem', fontWeight:400, opacity:0.85, marginTop:2 }}>{m.desc}</div>
            </button>
          ))}
        </div>

        {/* ── 28 يوم ── */}
        <div className="card">
          <div className="card-header">
            <h3>📅 {activeMenuData?.nameAr || 'المنيو الافتراضي'} — {menuType==='default'?'المنيو الرئيسي':'منيو الشيف'}</h3>
            <span className="badge badge-teal">{Object.keys(menuData).length} / 28 يوم مُعَد</span>
          </div>
          <div className="card-body">
            {[1,2,3,4].map(week => (
              <div key={week} style={{ marginBottom:16 }}>
                <div style={{ fontSize:'0.8rem', fontWeight:700, color:'#64748b', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>
                  الأسبوع {week}
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {CYCLE_DAYS.filter(d=>d.week===week).map(day => {
                    const hasMeals = menuData[day.key]?.length > 0;
                    return (
                      <button key={day.key} onClick={() => openDay(day.key)}
                        style={{ padding:'8px 14px', borderRadius:8, border:'none', cursor:'pointer',
                          fontFamily:'var(--font-main)', fontSize:'0.82rem', fontWeight:600, transition:'all 0.2s',
                          background: hasMeals ? (menuType==='default'?'#f0fdfa':'#f5f3ff') : '#f8fafc',
                          color: hasMeals ? (menuType==='default'?'#0f766e':'#7c3aed') : '#94a3b8',
                          border: hasMeals ? `1.5px solid ${menuType==='default'?'#ccfbf1':'#ede9fe'}` : '1.5px solid #e2e8f0',
                        }}>
                        {day.day}
                        {hasMeals && (
                          <span style={{ display:'inline-block', marginRight:6,
                            background: menuType==='default'?'#0d9488':'#7c3aed',
                            color:'white', borderRadius:999, fontSize:'0.65rem', padding:'1px 6px', fontWeight:700 }}>
                            {menuData[day.key].length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* نظرة عامة */}
        {Object.keys(menuData).length > 0 && (
          <div className="card" style={{ marginTop:20 }}>
            <div className="card-header"><h3>📊 نظرة عامة على المنيو</h3></div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>اليوم</th><th>🍳 فطور</th><th>🍛 غداء</th><th>🌙 عشاء</th><th>🥗 سناك</th><th>الإجمالي</th></tr></thead>
                <tbody>
                  {CYCLE_DAYS.filter(d=>menuData[d.key]?.length>0).map(day => {
                    const ids   = menuData[day.key]||[];
                    const meals = ids.map(id=>allMeals.find(m=>m.id===id)).filter(Boolean);
                    const byType = (t) => meals.filter(m=>m.mealType===t).map(m=>m.mealTitle).join('، ');
                    return (
                      <tr key={day.key}>
                        <td><strong>{day.label}</strong></td>
                        <td style={{ fontSize:'0.78rem', maxWidth:150 }}>{byType('افطار')||'—'}</td>
                        <td style={{ fontSize:'0.78rem', maxWidth:150 }}>{byType('غداء')||'—'}</td>
                        <td style={{ fontSize:'0.78rem', maxWidth:150 }}>{byType('عشاء')||'—'}</td>
                        <td style={{ fontSize:'0.78rem', maxWidth:150 }}>{byType('سناك')||'—'}</td>
                        <td><span className="badge badge-teal">{ids.length}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: تعديل يوم */}
      {showModal && (
        <div className="modal-overlay" onClick={()=>setShowModal(false)}>
          <div className="modal" style={{ maxWidth:700 }} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>{menuType==='default'?'📋':'👨‍🍳'} {selectedDayLabel} — {activeMenuData?.nameAr||'افتراضي'}</h3>
              <button className="modal-close" onClick={()=>setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                <input className="form-control" placeholder="🔍 بحث..." value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:1 }} />
                <select className="form-control" style={{ width:130 }} value={filterType} onChange={e=>setFilterType(e.target.value)}>
                  <option>الكل</option>
                  {MEAL_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'0.85rem', color:'#64748b' }}>محدد: <strong style={{ color:'#0d9488' }}>{selectedMeals.length}</strong> وجبة</span>
                <button style={{ fontSize:'0.8rem', color:'#ef4444', background:'none', border:'none', cursor:'pointer' }} onClick={()=>setSelectedMeals([])}>مسح الكل</button>
              </div>
              <div style={{ maxHeight:400, overflowY:'auto' }}>
                {allMeals.length === 0 && (
                  <div style={{ textAlign:'center', padding:'20px', color:'#94a3b8' }}>
                    لا يوجد وجبات — أضف وجبات من صفحة الوجبات أولاً
                  </div>
                )}
                {MEAL_TYPES.map(type => {
                  const typeMeals = filteredMeals.filter(m=>m.mealType===type);
                  if (!typeMeals.length) return null;
                  return (
                    <div key={type} style={{ marginBottom:12 }}>
                      <div style={{ fontSize:'0.78rem', fontWeight:700, color:'#64748b', padding:'4px 0', borderBottom:'1px solid #e2e8f0', marginBottom:6 }}>
                        {MEAL_ICONS[type]} {type} ({typeMeals.filter(m=>selectedMeals.includes(m.id)).length} محدد)
                      </div>
                      {typeMeals.map(meal => (
                        <label key={meal.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:8, cursor:'pointer',
                          background: selectedMeals.includes(meal.id)?'#f0fdfa':'transparent',
                          border: selectedMeals.includes(meal.id)?'1px solid #ccfbf1':'1px solid transparent',
                          marginBottom:3, transition:'all 0.15s' }}>
                          <input type="checkbox" checked={selectedMeals.includes(meal.id)} onChange={()=>toggleMeal(meal.id)} style={{ accentColor:'#0d9488', width:16, height:16 }} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:'0.88rem', fontWeight:600 }}>{meal.mealTitle}</div>
                            <div style={{ fontSize:'0.72rem', color:'#94a3b8' }}>P{meal.protein} | C{meal.carbs} | {meal.calories} cal</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={saveDay} disabled={saving}>
                  {saving ? '⏳ جاري الحفظ...' : `✅ حفظ (${selectedMeals.length} وجبة)`}
                </button>
                <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: إضافة/تعديل منيو */}
      {showMenuForm && (
        <div className="modal-overlay" onClick={()=>setShowMenuForm(false)}>
          <div className="modal" style={{ maxWidth:480 }} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editMenu ? '✏️ تعديل منيو' : '+ إضافة منيو جديد'}</h3>
              <button className="modal-close" onClick={()=>setShowMenuForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className="form-group">
                  <label className="form-label">الاسم بالعربي *</label>
                  <input className="form-control" value={menuForm.nameAr} onChange={e=>setMenuForm(p=>({...p,nameAr:e.target.value}))} placeholder="مثال: منيو رمضان" />
                </div>
                <div className="form-group">
                  <label className="form-label">Name in English *</label>
                  <input className="form-control" value={menuForm.nameEn} onChange={e=>setMenuForm(p=>({...p,nameEn:e.target.value}))} placeholder="e.g. Ramadan Menu" />
                </div>
                <div className="form-group">
                  <label className="form-label">وصف بالعربي</label>
                  <input className="form-control" value={menuForm.descAr} onChange={e=>setMenuForm(p=>({...p,descAr:e.target.value}))} placeholder="وصف اختياري" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description in English</label>
                  <input className="form-control" value={menuForm.descEn} onChange={e=>setMenuForm(p=>({...p,descEn:e.target.value}))} placeholder="Optional description" />
                </div>
              </div>
              <div style={{ background:'#fff7ed', border:'1px solid #fde68a', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:'0.8rem', color:'#d97706' }}>
                ⚠️ المنيو الجديد يُضاف بحالة <strong>معطل</strong> — فعّله يدوياً لما تخلص إعداده
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={saveMenu} disabled={savingMenu}>
                  {savingMenu ? '⏳...' : (editMenu ? '✅ حفظ التعديل' : '✅ إضافة المنيو')}
                </button>
                <button className="btn btn-ghost" onClick={()=>setShowMenuForm(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
