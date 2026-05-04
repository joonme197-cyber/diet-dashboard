import { useState, useEffect } from 'react';
import { getCoupons, addCoupon, updateCoupon, deleteCoupon } from '../firebase/couponService';
import { getPackages } from '../firebase/packageService';
import { useLang } from '../LanguageContext';

const EMPTY_FORM = {
  code: '', nameAr: '', nameEn: '',
  discountType: 'percentage', discountValue: '',
  maxDiscount: '',
  expiryDate: '', maxUsage: '',
  applicablePackages: [], // [] = كل الباقات
  applicableWeeks: [],    // [] = كل المدد
  applicableDurations: [], // [] = كل المدد بالـ label
  isActive: true,
};

export default function CouponsPage() {
  const { isAr } = useLang();
  const [coupons, setCoupons]     = useState([]);
  const [packages, setPackages]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCoupon, setEditCoupon] = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState('');
  const [msgType, setMsgType]     = useState('success');
  const [search, setSearch]       = useState('');

  // استخراج كل المدد الفريدة من الباقات تلقائياً
  const allDurations = (() => {
    const map = new Map();
    packages.forEach(pkg => {
      (pkg.prices || []).forEach(p => {
        if (p.duration) {
          const weeks = p.weeks || 0;
          const days  = p.days  || 0;
          const key   = p.duration;
          if (!map.has(key)) map.set(key, { label: p.duration, weeks, days });
        }
      });
    });
    return [...map.values()].sort((a,b) => (a.days||a.weeks*7||0) - (b.days||b.weeks*7||0));
  })();
  const showMsg = (m, t='success') => { setMsg(m); setMsgType(t); setTimeout(() => setMsg(''), 3000); };

  const load = async () => {
    setLoading(true);
    const [c, p] = await Promise.all([getCoupons(), getPackages()]);
    setCoupons(c); setPackages(p);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditCoupon(null);
    setForm({ ...EMPTY_FORM, expiryDate: '', code: '' });
    setShowModal(true);
  };

  const openEdit = (coupon) => {
    setEditCoupon(coupon);
    setForm({
      code:                coupon.code              || '',
      nameAr:              coupon.nameAr            || '',
      nameEn:              coupon.nameEn            || '',
      discountType:        coupon.discountType      || 'percentage',
      discountValue:       coupon.discountValue     || '',
      maxDiscount:         coupon.maxDiscount       || '',
      expiryDate:          coupon.expiryDate        || '',
      maxUsage:            coupon.maxUsage          || '',
      applicablePackages:  coupon.applicablePackages || [],
      applicableWeeks:     coupon.applicableWeeks   || [],
      isActive:            coupon.isActive !== false,
    });
    setShowModal(true);
  };

  const saveCoupon = async () => {
    if (!form.code || !form.discountValue) {
      showMsg(isAr ? '❌ الكود وقيمة الخصم مطلوبان' : '❌ Code and discount value required', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        code:          form.code.toUpperCase().trim(),
        discountValue: Number(form.discountValue),
        maxDiscount:   form.maxDiscount ? Number(form.maxDiscount) : null,
        maxUsage:      form.maxUsage    ? Number(form.maxUsage)    : null,
      };
      if (editCoupon) {
        await updateCoupon(editCoupon.id, data);
        showMsg(isAr ? '✅ تم التعديل' : '✅ Updated');
      } else {
        await addCoupon(data);
        showMsg(isAr ? '✅ تم إنشاء الكوبون' : '✅ Coupon created');
      }
      setShowModal(false);
      await load();
    } catch (err) {
      showMsg('❌ ' + err.message, 'error');
    }
    setSaving(false);
  };

  const toggleActive = async (coupon) => {
    await updateCoupon(coupon.id, { isActive: !coupon.isActive });
    setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, isActive: !c.isActive } : c));
  };

  const handleDelete = async (coupon) => {
    if (!window.confirm(isAr ? 'حذف هذا الكوبون؟' : 'Delete this coupon?')) return;
    await deleteCoupon(coupon.id);
    await load();
    showMsg(isAr ? 'تم الحذف' : 'Deleted');
  };

  // التبديل بالـ label عشان يكون ديناميكي مع أي مدة جديدة
  const toggleDuration = (label) => {
    setForm(p => ({
      ...p,
      applicableWeeks: p.applicableWeeks.includes(label)
        ? p.applicableWeeks.filter(x => x !== label)
        : [...p.applicableWeeks, label]
    }));
  };

  const toggleWeek = toggleDuration; // backward compat

  const togglePackage = (id) => {
    setForm(p => ({
      ...p,
      applicablePackages: p.applicablePackages.includes(id)
        ? p.applicablePackages.filter(x => x !== id)
        : [...p.applicablePackages, id]
    }));
  };

  const filtered = coupons.filter(c =>
    !search ||
    c.code?.toLowerCase().includes(search.toLowerCase()) ||
    c.nameAr?.includes(search)
  );

  const isExpired = (c) => c.expiryDate && c.expiryDate < new Date().toISOString().split('T')[0];
  const isMaxed   = (c) => c.maxUsage && c.usageCount >= c.maxUsage;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🎟 {isAr ? 'كوبونات الخصم' : 'Discount Coupons'}</h2>
          <div className="breadcrumb">{isAr ? 'إدارة أكواد الخصم' : 'Manage discount codes'}</div>
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <input className="form-control" style={{ width:'200px' }}
            placeholder={isAr?'🔍 بحث...':'🔍 Search...'}
            value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={openAdd}>
            + {isAr?'كوبون جديد':'New Coupon'}
          </button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className={`alert ${msgType==='error'?'alert-error':'alert-success'} fade-in`}>{msg}</div>}

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'20px' }}>
          {[
            { label: isAr?'إجمالي الكوبونات':'Total', value: coupons.length, color:'#0d9488', bg:'#f0fdfa' },
            { label: isAr?'نشط':'Active', value: coupons.filter(c=>c.isActive&&!isExpired(c)&&!isMaxed(c)).length, color:'#16a34a', bg:'#dcfce7' },
            { label: isAr?'إجمالي الاستخدامات':'Total Uses', value: coupons.reduce((s,c)=>s+(c.usageCount||0),0), color:'#7c3aed', bg:'#ede9fe' },
            { label: isAr?'منتهي الصلاحية':'Expired', value: coupons.filter(c=>isExpired(c)||isMaxed(c)).length, color:'#dc2626', bg:'#fee2e2' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background:s.bg }}>
                <span style={{ color:s.color, fontSize:'1.3rem' }}>🎟</span>
              </div>
              <div className="stat-info">
                <h3 style={{ color:s.color }}>{s.value}</h3>
                <p>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="table-wrapper">
            {loading ? (
              <div className="loading"><div className="spinner"/></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎟</div>
                <h3>{isAr?'لا يوجد كوبونات':'No coupons'}</h3>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{isAr?'الكود':'Code'}</th>
                    <th>{isAr?'الاسم':'Name'}</th>
                    <th>{isAr?'الخصم':'Discount'}</th>
                    <th>{isAr?'تطبيق على':'Applies To'}</th>
                    <th>{isAr?'الاستخدام':'Usage'}</th>
                    <th>{isAr?'الانتهاء':'Expiry'}</th>
                    <th>{isAr?'الحالة':'Status'}</th>
                    <th>{isAr?'إجراءات':'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(coupon => {
                    const expired = isExpired(coupon);
                    const maxed   = isMaxed(coupon);
                    const status  = !coupon.isActive ? 'disabled' : expired ? 'expired' : maxed ? 'maxed' : 'active';
                    const STATUS_STYLE = {
                      active:   { label: isAr?'نشط':'Active',       bg:'#dcfce7', color:'#16a34a' },
                      disabled: { label: isAr?'معطّل':'Disabled',   bg:'#f1f5f9', color:'#64748b' },
                      expired:  { label: isAr?'منتهي':'Expired',    bg:'#fee2e2', color:'#dc2626' },
                      maxed:    { label: isAr?'مستنفد':'Maxed Out', bg:'#fff7ed', color:'#d97706' },
                    };
                    const st = STATUS_STYLE[status];
                    return (
                      <tr key={coupon.id}>
                        <td>
                          <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:'1rem', color:'#0d9488', background:'#f0fdfa', padding:'3px 10px', borderRadius:'6px', letterSpacing:'1px' }}>
                            {coupon.code}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight:600 }}>{coupon.nameAr || '—'}</div>
                          <div style={{ fontSize:'0.75rem', color:'#94a3b8' }}>{coupon.nameEn}</div>
                        </td>
                        <td>
                          <span style={{ fontWeight:700, color:'#7c3aed', fontSize:'1rem' }}>
                            {coupon.discountType === 'percentage'
                              ? `${coupon.discountValue}%`
                              : `${coupon.discountValue} KWD`}
                          </span>
                          {coupon.maxDiscount && (
                            <div style={{ fontSize:'0.72rem', color:'#94a3b8' }}>
                              {isAr?'أقصى':'Max'}: {coupon.maxDiscount} KWD
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize:'0.8rem' }}>
                          {coupon.applicablePackages?.length > 0
                            ? coupon.applicablePackages.map(id => packages.find(p=>p.id===id)?.nameAr || id).join('، ')
                            : <span style={{ color:'#0d9488' }}>{isAr?'كل الباقات':'All packages'}</span>}
                          {coupon.applicableWeeks?.length > 0 && (
                            <div style={{ color:'#64748b' }}>{coupon.applicableWeeks.join(',')} {isAr?'أسابيع':'wks'}</div>
                          )}
                        </td>
                        <td style={{ textAlign:'center' }}>
                          <span style={{ fontWeight:700, color:'#7c3aed' }}>{coupon.usageCount || 0}</span>
                          {coupon.maxUsage && <span style={{ color:'#94a3b8', fontSize:'0.8rem' }}> / {coupon.maxUsage}</span>}
                        </td>
                        <td style={{ fontSize:'0.82rem', color: expired ? '#dc2626' : '#64748b' }}>
                          {coupon.expiryDate || (isAr?'بدون انتهاء':'No expiry')}
                        </td>
                        <td>
                          <span style={{ background:st.bg, color:st.color, padding:'3px 10px', borderRadius:'999px', fontSize:'0.78rem', fontWeight:700 }}>
                            {st.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ display:'flex', gap:'6px' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(coupon)}>✏️</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(coupon)}>
                              {coupon.isActive ? '🔴' : '🟢'}
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ color:'#ef4444' }} onClick={() => handleDelete(coupon)}>🗑</button>
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
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:'560px', maxHeight:'90vh', overflowY:'auto' }}>
            <div className="modal-header">
              <h3>🎟 {editCoupon ? (isAr?'تعديل كوبون':'Edit Coupon') : (isAr?'كوبون جديد':'New Coupon')}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">

                {/* الكود */}
                <div className="form-group">
                  <label className="form-label">🔤 {isAr?'كود الخصم':'Coupon Code'} *</label>
                  <input className="form-control" value={form.code}
                    onChange={e => setForm(p=>({...p,code:e.target.value.toUpperCase()}))}
                    placeholder="SUMMER25" style={{ fontFamily:'monospace', fontWeight:700, fontSize:'1.1rem', letterSpacing:'2px' }} />
                </div>

                {/* الاسم */}
                <div className="form-group">
                  <label className="form-label">{isAr?'اسم الكوبون (اختياري)':'Coupon Name (optional)'}</label>
                  <input className="form-control" value={form.nameAr}
                    onChange={e => setForm(p=>({...p,nameAr:e.target.value}))}
                    placeholder={isAr?'خصم الصيف':''} />
                </div>

                {/* نوع الخصم */}
                <div className="form-group full-width">
                  <label className="form-label">{isAr?'نوع الخصم':'Discount Type'}</label>
                  <div className="radio-group">
                    <div className="radio-option">
                      <input type="radio" id="pct" checked={form.discountType==='percentage'} onChange={() => setForm(p=>({...p,discountType:'percentage'}))} />
                      <label htmlFor="pct">% {isAr?'نسبة مئوية':'Percentage'}</label>
                    </div>
                    <div className="radio-option">
                      <input type="radio" id="fix" checked={form.discountType==='fixed'} onChange={() => setForm(p=>({...p,discountType:'fixed'}))} />
                      <label htmlFor="fix">KWD {isAr?'مبلغ ثابت':'Fixed Amount'}</label>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {form.discountType==='percentage' ? (isAr?'نسبة الخصم %':'Discount %') : (isAr?'قيمة الخصم KWD':'Discount KWD')} *
                  </label>
                  <input className="form-control" type="number" min="0" value={form.discountValue}
                    onChange={e => setForm(p=>({...p,discountValue:e.target.value}))} />
                </div>

                {form.discountType==='percentage' && (
                  <div className="form-group">
                    <label className="form-label">{isAr?'حد أقصى للخصم KWD (اختياري)':'Max Discount KWD (optional)'}</label>
                    <input className="form-control" type="number" min="0" value={form.maxDiscount}
                      onChange={e => setForm(p=>({...p,maxDiscount:e.target.value}))} />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">📅 {isAr?'تاريخ الانتهاء (اختياري)':'Expiry Date (optional)'}</label>
                  <input className="form-control" type="date" value={form.expiryDate}
                    onChange={e => setForm(p=>({...p,expiryDate:e.target.value}))} />
                </div>

                <div className="form-group">
                  <label className="form-label">{isAr?'حد أقصى للاستخدام (اختياري)':'Max Usage (optional)'}</label>
                  <input className="form-control" type="number" min="0" value={form.maxUsage}
                    onChange={e => setForm(p=>({...p,maxUsage:e.target.value}))}
                    placeholder={isAr?'فارغ = بلا حد':'Empty = unlimited'} />
                </div>

                {/* الباقات المطبق عليها */}
                <div className="form-group full-width">
                  <label className="form-label">📦 {isAr?'ينطبق على الباقات (فارغ = الكل)':'Applies to packages (empty = all)'}</label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginTop:'6px' }}>
                    {packages.map(pkg => (
                      <label key={pkg.id} style={{
                        display:'flex', alignItems:'center', gap:'6px', cursor:'pointer',
                        padding:'5px 12px', borderRadius:'8px', fontSize:'0.82rem', fontWeight:600,
                        background: form.applicablePackages.includes(pkg.id) ? '#0d9488' : '#f1f5f9',
                        color: form.applicablePackages.includes(pkg.id) ? 'white' : '#374151',
                        border: `1px solid ${form.applicablePackages.includes(pkg.id) ? '#0d9488' : '#e2e8f0'}`,
                      }}>
                        <input type="checkbox" style={{ display:'none' }}
                          checked={form.applicablePackages.includes(pkg.id)}
                          onChange={() => togglePackage(pkg.id)} />
                        {pkg.nameAr || pkg.nameEn}
                      </label>
                    ))}
                  </div>
                  {form.applicablePackages.length === 0 && (
                    <div style={{ fontSize:'0.75rem', color:'#0d9488', marginTop:'4px' }}>✅ {isAr?'ينطبق على كل الباقات':'Applies to all packages'}</div>
                  )}
                </div>

                {/* المدد المطبق عليها */}
                <div className="form-group full-width">
                  <label className="form-label">📅 {isAr?'ينطبق على المدد (فارغ = الكل)':'Applies to durations (empty = all)'}</label>
                  {allDurations.length === 0 ? (
                    <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginTop:6 }}>
                      {isAr ? 'لا يوجد مدد — أضف أسعار للباقات أولاً' : 'No durations found — add prices to packages first'}
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginTop:'6px' }}>
                      {allDurations.map(dur => (
                        <label key={dur.label} style={{
                          display:'flex', alignItems:'center', gap:'4px', cursor:'pointer',
                          padding:'5px 12px', borderRadius:'8px', fontSize:'0.82rem', fontWeight:700,
                          background: form.applicableWeeks.includes(dur.label) ? '#7c3aed' : '#f1f5f9',
                          color: form.applicableWeeks.includes(dur.label) ? 'white' : '#374151',
                          border: `1px solid ${form.applicableWeeks.includes(dur.label) ? '#7c3aed' : '#e2e8f0'}`,
                        }}>
                          <input type="checkbox" style={{ display:'none' }}
                            checked={form.applicableWeeks.includes(dur.label)}
                            onChange={() => toggleDuration(dur.label)} />
                          {dur.label}
                        </label>
                      ))}
                    </div>
                  )}
                  {form.applicableWeeks.length === 0 && (
                    <div style={{ fontSize:'0.75rem', color:'#0d9488', marginTop:'4px' }}>✅ {isAr?'ينطبق على كل المدد':'Applies to all durations'}</div>
                  )}
                </div>

                <div className="form-group full-width">
                  <label style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer' }}>
                    <input type="checkbox" checked={form.isActive} onChange={e => setForm(p=>({...p,isActive:e.target.checked}))} style={{ accentColor:'#0d9488', width:'16px', height:'16px' }} />
                    <span style={{ fontWeight:600, fontSize:'0.88rem' }}>{isAr?'الكوبون نشط':'Coupon Active'}</span>
                  </label>
                </div>

                <div className="form-group full-width">
                  <button className="btn btn-primary btn-full" onClick={saveCoupon} disabled={saving}>
                    {saving ? <><div className="spinner" style={{width:'16px',height:'16px',borderWidth:'2px'}}/> {isAr?'جاري الحفظ...':'Saving...'}</> : `✅ ${isAr?'حفظ الكوبون':'Save Coupon'}`}
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
