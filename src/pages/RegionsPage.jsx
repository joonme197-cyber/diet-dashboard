import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { useLang } from '../LanguageContext';
import { KUWAIT_REGIONS } from '../kuwaitRegions';
import * as XLSX from 'xlsx';
import { clearGovernoratesCache } from '../hooks/useGovernorates';

// بناء map للترجمة من KUWAIT_REGIONS (للاستخدام عند رفع Excel فقط)
const GOV_AR_MAP = {};
const REG_AR_MAP = {};
for (const [key, gov] of Object.entries(KUWAIT_REGIONS)) {
  GOV_AR_MAP[gov.en] = gov.ar;
  GOV_AR_MAP[gov.en.toLowerCase()] = gov.ar;
  GOV_AR_MAP[key] = gov.ar;
  for (const reg of gov.regions) {
    REG_AR_MAP[reg.en] = reg.ar;
    REG_AR_MAP[reg.en.toLowerCase()] = reg.ar;
  }
}

// بحث fuzzy بسيط — يتجاهل "Governorate" في النص
const normalizeGov = (s) => (s || '').replace(/\s*Governorate\s*/i, '').trim();
const findGovAr = (nameEn) => {
  const n = normalizeGov(nameEn);
  return GOV_AR_MAP[n] || GOV_AR_MAP[n.toLowerCase()] || n;
};
const findRegAr = (nameEn) => REG_AR_MAP[nameEn] || REG_AR_MAP[(nameEn||'').toLowerCase()] || nameEn;

export default function RegionsPage() {
  const { lang } = useLang();
  const isAr = lang === 'ar';
  const fileRef = useRef();

  const [governorates, setGovernorates] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [uploading, setUploading]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [msg, setMsg]                   = useState('');
  const [selectedGov, setSelectedGov]   = useState(null);

  // Modals
  const [showAddGov, setShowAddGov]       = useState(false);
  const [showEditGov, setShowEditGov]     = useState(false);
  const [showAddRegion, setShowAddRegion] = useState(false);
  const [newGovForm, setNewGovForm]       = useState({ ar: '', en: '' });
  const [editGovForm, setEditGovForm]     = useState({ ar: '', en: '' });
  const [newRegion, setNewRegion]         = useState({ ar: '', en: '' });

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'governorates'));
    const data = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.nameAr || '').localeCompare(b.nameAr || ''));
    setGovernorates(data);
    // حدّث selectedGov لو موجود
    if (selectedGov) {
      const updated = data.find(g => g.id === selectedGov.id);
      setSelectedGov(updated || null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── رفع Excel ──
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);

        // تجميع المناطق حسب المحافظة مع الترجمة التلقائية
        const govMap = {};
        for (const row of rows) {
          const govEn = normalizeGov((row['governorate'] || row['Governorate'] || '').trim());
          const regEn = (row['region'] || row['Region'] || '').trim();
          if (!govEn) continue;
          if (!govMap[govEn]) govMap[govEn] = [];
          if (regEn) govMap[govEn].push({
            en: regEn,
            ar: findRegAr(regEn),
            active: true,
          });
        }

        // رفع لـ Firestore مع الترجمة
        for (const [govEn, regions] of Object.entries(govMap)) {
          await addDoc(collection(db, 'governorates'), {
            nameEn: govEn,
            nameAr: findGovAr(govEn),
            regions,
            active: true,
            createdAt: serverTimestamp(),
          });
        }

        await load();
        clearGovernoratesCache();
        showMsg(isAr
          ? `✅ تم رفع ${Object.keys(govMap).length} محافظة`
          : `✅ Uploaded ${Object.keys(govMap).length} governorates`);
      } catch (err) {
        console.error(err);
        showMsg(isAr ? '❌ خطأ في قراءة الملف' : '❌ Error reading file');
      }
      setUploading(false);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // ── إضافة محافظة ──
  const addGovernorate = async () => {
    if (!newGovForm.en) return;
    await addDoc(collection(db, 'governorates'), {
      nameAr: newGovForm.ar || newGovForm.en,
      nameEn: newGovForm.en,
      regions: [], active: true,
      createdAt: serverTimestamp(),
    });
    setShowAddGov(false); setNewGovForm({ ar: '', en: '' });
    clearGovernoratesCache();
      load(); showMsg(isAr ? 'تمت إضافة المحافظة' : 'Governorate added');
  };

  // ── تعديل محافظة ──
  const editGovernorate = async () => {
    if (!selectedGov) return;
    await updateDoc(doc(db, 'governorates', selectedGov.id), {
      nameAr: editGovForm.ar, nameEn: editGovForm.en,
    });
    setShowEditGov(false); clearGovernoratesCache();
      load();
    showMsg(isAr ? 'تم التعديل' : 'Updated');
  };

  // ── حذف محافظة ──
  const deleteGovernorate = async (id) => {
    if (!window.confirm(isAr ? 'حذف هذه المحافظة؟' : 'Delete this governorate?')) return;
    await deleteDoc(doc(db, 'governorates', id));
    setSelectedGov(null); clearGovernoratesCache();
      load();
  };

  // ── تفعيل/تعطيل محافظة ──
  const toggleGovActive = async (gov) => {
    await updateDoc(doc(db, 'governorates', gov.id), { active: !gov.active });
    clearGovernoratesCache();
    load();
  };

  // ── إضافة منطقة ──
  const addRegion = async () => {
    if (!newRegion.en || !selectedGov) return;
    setSaving(true);
    const regions = [...(selectedGov.regions || []), {
      en: newRegion.en, ar: newRegion.ar || newRegion.en, active: true,
    }];
    await updateDoc(doc(db, 'governorates', selectedGov.id), { regions });
    setNewRegion({ ar: '', en: '' }); setShowAddRegion(false);
    clearGovernoratesCache();
      load(); setSaving(false);
    showMsg(isAr ? 'تمت إضافة المنطقة' : 'Region added');
  };

  // ── تعديل منطقة ──
  const editRegion = async (govId, idx, newAr, newEn) => {
    const gov = governorates.find(g => g.id === govId);
    if (!gov) return;
    const regions = [...gov.regions];
    regions[idx] = { ...regions[idx], ar: newAr, en: newEn };
    await updateDoc(doc(db, 'governorates', govId), { regions });
    clearGovernoratesCache();
    load();
  };

  // ── تفعيل/تعطيل منطقة ──
  const toggleRegionActive = async (govId, idx) => {
    const gov = governorates.find(g => g.id === govId);
    if (!gov) return;
    const regions = [...gov.regions];
    regions[idx] = { ...regions[idx], active: !regions[idx].active };
    await updateDoc(doc(db, 'governorates', govId), { regions });
    clearGovernoratesCache();
    load();
  };

  // ── حذف منطقة ──
  const deleteRegion = async (govId, idx) => {
    const gov = governorates.find(g => g.id === govId);
    if (!gov) return;
    const regions = gov.regions.filter((_, i) => i !== idx);
    await updateDoc(doc(db, 'governorates', govId), { regions });
    clearGovernoratesCache();
    load(); showMsg(isAr ? 'تم الحذف' : 'Deleted');
  };

  // ── رفع مناطق الكويت من الملف المحلي ──
  const [seeding, setSeeding] = useState(false);
  const seedKuwaitRegions = async () => {
    if (governorates.length > 0) {
      if (!window.confirm(isAr
        ? 'يوجد محافظات بالفعل. هل تريد إضافة مناطق الكويت؟ (لن يتم حذف الموجود)'
        : 'Governorates already exist. Add Kuwait regions? (existing data will not be deleted)')) return;
    }
    setSeeding(true);
    try {
      let count = 0;
      for (const [key, gov] of Object.entries(KUWAIT_REGIONS)) {
        // تحقق إن المحافظة مش موجودة بالفعل
        const exists = governorates.find(g =>
          g.nameAr === gov.ar || g.nameEn === gov.en
        );
        if (exists) {
          // حدّث المناطق لو موجودة
          const existingNames = (exists.regions || []).map(r => r.ar);
          const newRegions = gov.regions
            .filter(r => !existingNames.includes(r.ar))
            .map(r => ({ ...r, nameAr: r.ar, nameEn: r.en, active: true }));
          if (newRegions.length > 0) {
            await updateDoc(doc(db, 'governorates', exists.id), {
              regions: [...(exists.regions || []), ...newRegions],
            });
            count++;
          }
        } else {
          // أضف محافظة جديدة
          await addDoc(collection(db, 'governorates'), {
            nameAr: gov.ar,
            nameEn: gov.en,
            active: true,
            regions: gov.regions.map(r => ({
              ar: r.ar, nameAr: r.ar,
              en: r.en, nameEn: r.en,
              active: true,
            })),
            createdAt: serverTimestamp(),
          });
          count++;
        }
      }
      clearGovernoratesCache();
      await load();
      showMsg(isAr ? `✅ تم رفع ${count} محافظة بمناطقها` : `✅ Uploaded ${count} governorates with regions`);
    } catch (err) {
      showMsg(isAr ? '❌ خطأ: ' + err.message : '❌ Error: ' + err.message);
    }
    setSeeding(false);
  };

  const activeRegions   = (gov) => (gov?.regions || []).filter(r => r.active !== false).length;
  const inactiveRegions = (gov) => (gov?.regions || []).filter(r => r.active === false).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🗺 {isAr ? 'المحافظات والمناطق' : 'Governorates & Regions'}</h2>
          <div className="breadcrumb">{isAr ? 'إدارة مناطق التوصيل' : 'Manage Delivery Regions'}</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* رفع مناطق الكويت */}
          <button className="btn btn-primary" style={{ background: '#16a34a' }} onClick={seedKuwaitRegions} disabled={seeding}>
            {seeding ? '⏳ جاري الرفع...' : '🇰🇼'} {isAr ? 'رفع مناطق الكويت' : 'Upload Kuwait Regions'}
          </button>
          {/* رفع Excel */}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleExcelUpload} />
          <button className="btn btn-outline" onClick={() => fileRef.current.click()} disabled={uploading}>
            {uploading ? '⏳' : '📂'} {isAr ? 'رفع Excel' : 'Upload Excel'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddGov(true)}>
            + {isAr ? 'إضافة محافظة' : 'Add Governorate'}
          </button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        {loading ? (
          <div className="loading"><div className="spinner" />{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>

            {/* ── قائمة المحافظات ── */}
            <div className="card">
              <div className="card-header">
                <h3>{isAr ? 'المحافظات' : 'Governorates'}</h3>
                <span className="badge badge-teal">{governorates.length}</span>
              </div>
              <div style={{ padding: '8px' }}>
                {governorates.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px' }}>
                    <h3>{isAr ? 'لا يوجد محافظات' : 'No Governorates'}</h3>
                    <button className="btn btn-primary btn-sm" style={{ marginTop: '8px' }}
                      onClick={() => fileRef.current.click()}>
                      {isAr ? 'رفع من Excel' : 'Upload from Excel'}
                    </button>
                  </div>
                ) : governorates.map(gov => (
                  <div key={gov.id}
                    onClick={() => setSelectedGov(gov)}
                    style={{
                      padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                      marginBottom: '4px', transition: 'all 0.15s',
                      background: selectedGov?.id === gov.id ? '#f0fdfa' : 'transparent',
                      border: `1.5px solid ${selectedGov?.id === gov.id ? '#ccfbf1' : 'transparent'}`,
                      opacity: gov.active === false ? 0.5 : 1,
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isAr ? gov.nameAr : gov.nameEn}
                          {gov.active === false && (
                            <span style={{ fontSize: '0.65rem', background: '#fee2e2', color: '#dc2626', padding: '1px 5px', borderRadius: '4px' }}>
                              {isAr ? 'معطل' : 'Off'}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {activeRegions(gov)} {isAr ? 'نشط' : 'active'} •{' '}
                          {inactiveRegions(gov) > 0 && `${inactiveRegions(gov)} ${isAr ? 'معطل' : 'off'}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {/* تفعيل/تعطيل */}
                        <button title={gov.active === false ? (isAr ? 'تفعيل' : 'Enable') : (isAr ? 'تعطيل' : 'Disable')}
                          onClick={e => { e.stopPropagation(); toggleGovActive(gov); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                          {gov.active === false ? '🔴' : '🟢'}
                        </button>
                        <button onClick={e => { e.stopPropagation(); setSelectedGov(gov); setEditGovForm({ ar: gov.nameAr, en: gov.nameEn }); setShowEditGov(true); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#0d9488' }}>✏️</button>
                        <button onClick={e => { e.stopPropagation(); deleteGovernorate(gov.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#ef4444' }}>🗑</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── مناطق المحافظة ── */}
            <div className="card">
              <div className="card-header">
                <h3>
                  {selectedGov
                    ? `${isAr ? 'مناطق' : 'Regions of'} ${isAr ? selectedGov.nameAr : selectedGov.nameEn}`
                    : (isAr ? 'اختر محافظة' : 'Select Governorate')}
                </h3>
                {selectedGov && (
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddRegion(true)}>
                    + {isAr ? 'إضافة منطقة' : 'Add Region'}
                  </button>
                )}
              </div>

              {!selectedGov ? (
                <div className="empty-state">
                  <div className="empty-icon">🗺️</div>
                  <h3>{isAr ? 'اختر محافظة من القائمة' : 'Select a governorate'}</h3>
                </div>
              ) : (
                <div style={{ padding: '12px' }}>
                  {(selectedGov.regions || []).length === 0 ? (
                    <div className="empty-state"><h3>{isAr ? 'لا يوجد مناطق' : 'No regions'}</h3></div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {(selectedGov.regions || []).map((region, i) => (
                        <RegionCard
                          key={i}
                          region={region}
                          isAr={isAr}
                          onEdit={(ar, en) => editRegion(selectedGov.id, i, ar, en)}
                          onDelete={() => deleteRegion(selectedGov.id, i)}
                          onToggle={() => toggleRegionActive(selectedGov.id, i)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: إضافة محافظة ── */}
      {showAddGov && (
        <div className="modal-overlay" onClick={() => setShowAddGov(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isAr ? 'إضافة محافظة' : 'Add Governorate'}</h3>
              <button className="modal-close" onClick={() => setShowAddGov(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-1">
                <div className="form-group">
                  <label className="form-label">{isAr ? 'الاسم بالعربي' : 'Arabic Name'}</label>
                  <input className="form-control" value={newGovForm.ar} onChange={e => setNewGovForm(p => ({...p, ar: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{isAr ? 'الاسم بالإنجليزي' : 'English Name'}</label>
                  <input className="form-control" value={newGovForm.en} onChange={e => setNewGovForm(p => ({...p, en: e.target.value}))} />
                </div>
                <button className="btn btn-primary btn-full" onClick={addGovernorate}>
                  {isAr ? 'إضافة' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: تعديل محافظة ── */}
      {showEditGov && (
        <div className="modal-overlay" onClick={() => setShowEditGov(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isAr ? 'تعديل المحافظة' : 'Edit Governorate'}</h3>
              <button className="modal-close" onClick={() => setShowEditGov(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-1">
                <div className="form-group">
                  <label className="form-label">{isAr ? 'الاسم بالعربي' : 'Arabic Name'}</label>
                  <input className="form-control" value={editGovForm.ar} onChange={e => setEditGovForm(p => ({...p, ar: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{isAr ? 'الاسم بالإنجليزي' : 'English Name'}</label>
                  <input className="form-control" value={editGovForm.en} onChange={e => setEditGovForm(p => ({...p, en: e.target.value}))} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={editGovernorate}>{isAr ? 'حفظ' : 'Save'}</button>
                  <button className="btn btn-ghost" onClick={() => setShowEditGov(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: إضافة منطقة ── */}
      {showAddRegion && (
        <div className="modal-overlay" onClick={() => setShowAddRegion(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isAr ? 'إضافة منطقة' : 'Add Region'}</h3>
              <button className="modal-close" onClick={() => setShowAddRegion(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-1">
                <div className="form-group">
                  <label className="form-label">{isAr ? 'الاسم بالعربي' : 'Arabic Name'}</label>
                  <input className="form-control" value={newRegion.ar} onChange={e => setNewRegion(p => ({...p, ar: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{isAr ? 'الاسم بالإنجليزي' : 'English Name'}</label>
                  <input className="form-control" value={newRegion.en} onChange={e => setNewRegion(p => ({...p, en: e.target.value}))} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={addRegion} disabled={saving}>
                    {saving ? '...' : (isAr ? 'إضافة' : 'Add')}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowAddRegion(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── بطاقة المنطقة ──
function RegionCard({ region, isAr, onEdit, onDelete, onToggle }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ ar: region.ar, en: region.en });
  const isActive = region.active !== false;

  if (editing) {
    return (
      <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '8px', padding: '10px' }}>
        <input className="form-control" value={form.ar} onChange={e => setForm(p => ({...p, ar: e.target.value}))}
          placeholder="عربي" style={{ marginBottom: '6px', fontSize: '0.8rem' }} />
        <input className="form-control" value={form.en} onChange={e => setForm(p => ({...p, en: e.target.value}))}
          placeholder="English" style={{ marginBottom: '8px', fontSize: '0.8rem' }} />
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => { onEdit(form.ar, form.en); setEditing(false); }}>✓</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: isActive ? 'white' : '#f8fafc',
      border: `1px solid ${isActive ? '#e2e8f0' : '#f1f5f9'}`,
      borderRadius: '8px', padding: '10px 12px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      opacity: isActive ? 1 : 0.6, transition: 'all 0.15s',
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isActive ? '#1e293b' : '#94a3b8' }}>
          {isAr ? region.ar : region.en}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
          {isAr ? region.en : region.ar}
        </div>
        {!isActive && (
          <span style={{ fontSize: '0.65rem', background: '#fee2e2', color: '#dc2626', padding: '1px 5px', borderRadius: '4px' }}>
            {isAr ? 'معطل' : 'Off'}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '4px', flexDirection: 'column', alignItems: 'center' }}>
        <button onClick={onToggle} title={isActive ? (isAr ? 'تعطيل' : 'Disable') : (isAr ? 'تفعيل' : 'Enable')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>
          {isActive ? '🟢' : '🔴'}
        </button>
        <button onClick={() => setEditing(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#0d9488' }}>✏️</button>
        <button onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#ef4444' }}>🗑</button>
      </div>
    </div>
  );
}
