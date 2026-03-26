import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useLang } from '../context/LanguageContext';
import { KUWAIT_REGIONS } from '../utils/kuwaitRegions';

export default function RegionsPage() {
  const { lang, t } = useLang();
  const [governorates, setGovernorates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [selectedGov, setSelectedGov] = useState(null);
  const [showAddRegion, setShowAddRegion] = useState(false);
  const [showEditGov, setShowEditGov] = useState(false);
  const [showAddGov, setShowAddGov] = useState(false);
  const [newRegion, setNewRegion] = useState({ ar: '', en: '' });
  const [editGovForm, setEditGovForm] = useState({ ar: '', en: '' });
  const [newGovForm, setNewGovForm] = useState({ ar: '', en: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'governorates'));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setGovernorates(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  // رفع البيانات من الملف
  const uploadFromExcel = async () => {
    setUploading(true);
    for (const [govKey, govData] of Object.entries(KUWAIT_REGIONS)) {
      const docRef = await addDoc(collection(db, 'governorates'), {
        nameAr: govData.ar,
        nameEn: govData.en,
        regions: govData.regions,
        createdAt: serverTimestamp(),
      });
    }
    setUploading(false);
    load();
    showMsg(lang === 'ar' ? 'تم رفع البيانات بنجاح!' : 'Data uploaded successfully!');
  };

  // إضافة محافظة جديدة
  const addGovernorate = async () => {
    if (!newGovForm.ar || !newGovForm.en) return;
    await addDoc(collection(db, 'governorates'), {
      nameAr: newGovForm.ar, nameEn: newGovForm.en,
      regions: [], createdAt: serverTimestamp(),
    });
    setShowAddGov(false);
    setNewGovForm({ ar: '', en: '' });
    load(); showMsg(lang === 'ar' ? 'تمت إضافة المحافظة' : 'Governorate added');
  };

  // تعديل محافظة
  const editGovernorate = async () => {
    if (!selectedGov) return;
    await updateDoc(doc(db, 'governorates', selectedGov.id), {
      nameAr: editGovForm.ar, nameEn: editGovForm.en,
    });
    setShowEditGov(false);
    load(); showMsg(lang === 'ar' ? 'تم التعديل' : 'Updated');
  };

  // حذف محافظة
  const deleteGovernorate = async (id) => {
    const confirm = window.confirm(lang === 'ar' ? 'حذف هذه المحافظة؟' : 'Delete this governorate?');
    if (!confirm) return;
    await deleteDoc(doc(db, 'governorates', id));
    load();
  };

  // إضافة منطقة
  const addRegion = async () => {
    if (!newRegion.en || !selectedGov) return;
    setSaving(true);
    const regions = [...(selectedGov.regions || []), { en: newRegion.en, ar: newRegion.ar || newRegion.en }];
    await updateDoc(doc(db, 'governorates', selectedGov.id), { regions });
    setNewRegion({ ar: '', en: '' });
    setShowAddRegion(false);
    load(); setSaving(false);
    showMsg(lang === 'ar' ? 'تمت إضافة المنطقة' : 'Region added');
  };

  // تعديل اسم منطقة
  const editRegion = async (govId, regionIndex, newAr, newEn) => {
    const gov = governorates.find(g => g.id === govId);
    if (!gov) return;
    const regions = [...gov.regions];
    regions[regionIndex] = { ar: newAr, en: newEn };
    await updateDoc(doc(db, 'governorates', govId), { regions });
    load();
  };

  // حذف منطقة
  const deleteRegion = async (govId, regionIndex) => {
    const gov = governorates.find(g => g.id === govId);
    if (!gov) return;
    const regions = gov.regions.filter((_, i) => i !== regionIndex);
    await updateDoc(doc(db, 'governorates', govId), { regions });
    load();
    showMsg(lang === 'ar' ? 'تم الحذف' : 'Deleted');
  };

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div dir={dir}>
      <div className="page-header">
        <div>
          <h2>{lang === 'ar' ? 'المحافظات والمناطق' : 'Governorates & Regions'}</h2>
          <div className="breadcrumb">{lang === 'ar' ? 'إدارة المناطق الجغرافية' : 'Manage Geographic Areas'}</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {governorates.length === 0 && (
            <button className="btn btn-ghost" onClick={uploadFromExcel} disabled={uploading}>
              {uploading ? '...' : (lang === 'ar' ? 'رفع من Excel' : 'Upload from Excel')}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowAddGov(true)}>
            + {lang === 'ar' ? 'إضافة محافظة' : 'Add Governorate'}
          </button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        {loading ? (
          <div className="loading"><div className="spinner" />{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>

            {/* قائمة المحافظات */}
            <div className="card">
              <div className="card-header">
                <h3>{lang === 'ar' ? 'المحافظات' : 'Governorates'}</h3>
                <span className="badge badge-teal">{governorates.length}</span>
              </div>
              <div style={{ padding: '8px' }}>
                {governorates.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px' }}>
                    <h3>{lang === 'ar' ? 'لا يوجد محافظات' : 'No Governorates'}</h3>
                    <button className="btn btn-primary btn-sm" style={{ marginTop: '8px' }} onClick={uploadFromExcel}>
                      {lang === 'ar' ? 'رفع من Excel' : 'Upload from Excel'}
                    </button>
                  </div>
                ) : (
                  governorates.map(gov => (
                    <div key={gov.id}
                      onClick={() => setSelectedGov(gov)}
                      style={{
                        padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                        marginBottom: '4px', transition: 'all 0.15s',
                        background: selectedGov?.id === gov.id ? '#f0fdfa' : 'transparent',
                        border: selectedGov?.id === gov.id ? '1.5px solid #ccfbf1' : '1.5px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                            {lang === 'ar' ? gov.nameAr : gov.nameEn}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {lang === 'ar' ? gov.nameEn : gov.nameAr} • {(gov.regions||[]).length} {lang === 'ar' ? 'منطقة' : 'regions'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-ghost btn-sm"
                            onClick={e => { e.stopPropagation(); setSelectedGov(gov); setEditGovForm({ ar: gov.nameAr, en: gov.nameEn }); setShowEditGov(true); }}
                            style={{ padding: '4px 8px' }}>✏️</button>
                          <button className="btn btn-danger btn-sm"
                            onClick={e => { e.stopPropagation(); deleteGovernorate(gov.id); }}
                            style={{ padding: '4px 8px' }}>🗑</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* قائمة المناطق */}
            <div className="card">
              <div className="card-header">
                <h3>
                  {selectedGov
                    ? `${lang === 'ar' ? 'مناطق' : 'Regions of'} ${lang === 'ar' ? selectedGov.nameAr : selectedGov.nameEn}`
                    : (lang === 'ar' ? 'اختر محافظة' : 'Select a Governorate')
                  }
                </h3>
                {selectedGov && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span className="badge badge-teal">{(selectedGov.regions||[]).length} {lang === 'ar' ? 'منطقة' : 'regions'}</span>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowAddRegion(true)}>
                      + {lang === 'ar' ? 'إضافة منطقة' : 'Add Region'}
                    </button>
                  </div>
                )}
              </div>

              {!selectedGov ? (
                <div className="empty-state">
                  <div className="empty-icon">🗺️</div>
                  <h3>{lang === 'ar' ? 'اختر محافظة من اليمين' : 'Select a governorate'}</h3>
                </div>
              ) : (
                <div style={{ padding: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {(selectedGov.regions||[]).map((region, i) => (
                      <RegionCard
                        key={i}
                        region={region}
                        lang={lang}
                        onEdit={(newAr, newEn) => editRegion(selectedGov.id, i, newAr, newEn)}
                        onDelete={() => deleteRegion(selectedGov.id, i)}
                      />
                    ))}
                  </div>
                  {(selectedGov.regions||[]).length === 0 && (
                    <div className="empty-state">
                      <h3>{lang === 'ar' ? 'لا يوجد مناطق' : 'No regions'}</h3>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: إضافة محافظة */}
      {showAddGov && (
        <div className="modal-overlay" onClick={() => setShowAddGov(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{lang === 'ar' ? 'إضافة محافظة' : 'Add Governorate'}</h3>
              <button className="modal-close" onClick={() => setShowAddGov(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-1">
                <div className="form-group">
                  <label className="form-label">{lang === 'ar' ? 'الاسم بالعربي' : 'Arabic Name'}</label>
                  <input className="form-control" value={newGovForm.ar} onChange={e => setNewGovForm(p => ({...p, ar: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{lang === 'ar' ? 'الاسم بالإنجليزي' : 'English Name'}</label>
                  <input className="form-control" value={newGovForm.en} onChange={e => setNewGovForm(p => ({...p, en: e.target.value}))} />
                </div>
                <button className="btn btn-primary btn-full" onClick={addGovernorate}>
                  {lang === 'ar' ? 'إضافة' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: تعديل محافظة */}
      {showEditGov && (
        <div className="modal-overlay" onClick={() => setShowEditGov(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{lang === 'ar' ? 'تعديل المحافظة' : 'Edit Governorate'}</h3>
              <button className="modal-close" onClick={() => setShowEditGov(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-1">
                <div className="form-group">
                  <label className="form-label">{lang === 'ar' ? 'الاسم بالعربي' : 'Arabic Name'}</label>
                  <input className="form-control" value={editGovForm.ar} onChange={e => setEditGovForm(p => ({...p, ar: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{lang === 'ar' ? 'الاسم بالإنجليزي' : 'English Name'}</label>
                  <input className="form-control" value={editGovForm.en} onChange={e => setEditGovForm(p => ({...p, en: e.target.value}))} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={editGovernorate}>
                    {lang === 'ar' ? 'حفظ' : 'Save'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowEditGov(false)}>
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: إضافة منطقة */}
      {showAddRegion && (
        <div className="modal-overlay" onClick={() => setShowAddRegion(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{lang === 'ar' ? 'إضافة منطقة' : 'Add Region'}</h3>
              <button className="modal-close" onClick={() => setShowAddRegion(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-1">
                <div className="form-group">
                  <label className="form-label">{lang === 'ar' ? 'الاسم بالعربي' : 'Arabic Name'}</label>
                  <input className="form-control" value={newRegion.ar} onChange={e => setNewRegion(p => ({...p, ar: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{lang === 'ar' ? 'الاسم بالإنجليزي' : 'English Name'}</label>
                  <input className="form-control" value={newRegion.en} onChange={e => setNewRegion(p => ({...p, en: e.target.value}))} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={addRegion} disabled={saving}>
                    {saving ? '...' : (lang === 'ar' ? 'إضافة' : 'Add')}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowAddRegion(false)}>
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
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

// مكون بطاقة المنطقة
function RegionCard({ region, lang, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ar: region.ar, en: region.en });

  const handleSave = () => {
    onEdit(form.ar, form.en);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '8px', padding: '10px' }}>
        <input className="form-control" value={form.ar} onChange={e => setForm(p => ({...p, ar: e.target.value}))}
          placeholder="عربي" style={{ marginBottom: '6px', fontSize: '0.8rem' }} />
        <input className="form-control" value={form.en} onChange={e => setForm(p => ({...p, en: e.target.value}))}
          placeholder="English" style={{ marginBottom: '8px', fontSize: '0.8rem' }} />
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: '0.75rem' }} onClick={handleSave}>✓</button>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => setEditing(false)}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px',
      padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      transition: 'all 0.15s',
    }}
      onMouseOver={e => e.currentTarget.style.borderColor = '#ccfbf1'}
      onMouseOut={e => e.currentTarget.style.borderColor = '#e2e8f0'}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{lang === 'ar' ? region.ar : region.en}</div>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{lang === 'ar' ? region.en : region.ar}</div>
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button onClick={() => setEditing(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#0d9488' }}>✏️</button>
        <button onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#ef4444' }}>🗑</button>
      </div>
    </div>
  );
}
