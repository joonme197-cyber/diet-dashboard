import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getClients, addClient, updateClient } from '../firebase/clientService';
import { addSubscription } from '../firebase/subscriptionService';
import { getPackages } from '../firebase/packageService';
import { useLang } from '../LanguageContext';
import { REGIONS_DATA } from '../LanguageContext'; // fallback
import { useGovernorates } from '../hooks/useGovernorates';
import { getPricingSettings, calcCustomPrice, getFlexSettings, DEFAULT_FLEX_SETTINGS } from '../firebase/pricingService';
import { validateCoupon, calcDiscount, recordCouponUsage } from '../firebase/couponService';
import { db } from '../firebase/config';
import { getDoc, doc } from 'firebase/firestore';

const PAYMENT_METHODS = ['كاش / Cash', 'Knet', 'Visa/Mastercard', 'WhatsApp Link', 'آجل / Credit'];
const PROTEIN_OPTIONS = [80, 90, 100, 120, 150, 180, 200];
const CARBS_OPTIONS   = [50, 80, 100, 120, 150, 200];
const DAYS_AR = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
const DAYS_EN = ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'];
const DURATION_LABELS = {
  7:'1 أسبوع', 14:'2 أسبوع', 21:'3 أسابيع', 20:'20 يوم',
  26:'26 يوم', 28:'1 شهر', 35:'5 أسابيع', 42:'6 أسابيع', 56:'2 شهر', 84:'3 شهور',
};
// مكونات مساعدة للباقة المرنة
function FChip({ label, active, color, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding:'6px 14px', borderRadius:999, fontFamily:'var(--font-main)',
      fontWeight:700, fontSize:'0.83rem', cursor:'pointer', transition:'all 0.15s',
      border:`2px solid ${active ? color : '#e2e8f0'}`,
      background: active ? color : 'white',
      color: active ? 'white' : '#374151',
      boxShadow: active ? `0 2px 8px ${color}40` : 'none',
    }}>{label}</button>
  );
}
function FSection({ icon, title, children }) {
  return (
    <div style={{ marginBottom:14, padding:'12px 14px', borderRadius:10,
      border:'1.5px solid #e2e8f0', background:'#fafafa' }}>
      <div style={{ fontWeight:700, fontSize:'0.83rem', marginBottom:10, color:'#374151',
        display:'flex', alignItems:'center', gap:6 }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  );
}
function FMealRow({ icon, label, enabled, count, max, onToggle, onCount }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
      borderRadius:8, marginBottom:6, transition:'all 0.2s',
      border:`1.5px solid ${enabled?'#0d9488':'#e2e8f0'}`,
      background: enabled?'#f0fdfa':'white',
    }}>
      <div onClick={onToggle} style={{
        width:38, height:21, borderRadius:999, position:'relative', cursor:'pointer', flexShrink:0,
        background:enabled?'#0d9488':'#cbd5e1', transition:'background 0.2s',
      }}>
        <div style={{ position:'absolute', top:2, width:17, height:17, borderRadius:'50%',
          background:'white', transition:'left 0.2s', left:enabled?19:2,
          boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
      </div>
      <span style={{ fontSize:'1rem' }}>{icon}</span>
      <span style={{ fontWeight:700, flex:1, fontSize:'0.85rem',
        color:enabled?'#0f172a':'#94a3b8' }}>{label}</span>
      {enabled && (
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button type="button" onClick={()=>count>1&&onCount(count-1)}
            style={{ width:26,height:26,borderRadius:'50%',border:'1.5px solid #e2e8f0',
              background:'white',cursor:count>1?'pointer':'default',fontWeight:900,fontSize:'0.9rem',
              display:'flex',alignItems:'center',justifyContent:'center',
              color:count>1?'#0d9488':'#94a3b8' }}>−</button>
          <span style={{ fontWeight:900, minWidth:18, textAlign:'center' }}>{count}</span>
          <button type="button" onClick={()=>count<max&&onCount(count+1)}
            style={{ width:26,height:26,borderRadius:'50%',border:'1.5px solid #e2e8f0',
              background:'white',cursor:count<max?'pointer':'default',fontWeight:900,fontSize:'0.9rem',
              display:'flex',alignItems:'center',justifyContent:'center',
              color:count<max?'#0d9488':'#94a3b8' }}>+</button>
        </div>
      )}
    </div>
  );
}
const MEAL_TYPES_CONFIG = [
  { key: 'breakfast', ar: 'الفطور', en: 'Breakfast', icon: '🍳', allowKey: 'allowBreakfast', maxKey: 'allowedBreakfast' },
  { key: 'lunch',     ar: 'الغداء', en: 'Lunch',     icon: '🍛', allowKey: 'allowLunch',     maxKey: 'allowedLunch'     },
  { key: 'dinner',    ar: 'العشاء', en: 'Dinner',    icon: '🌙', allowKey: 'allowDinner',    maxKey: 'allowedDinner'    },
  { key: 'snacks',    ar: 'السناك', en: 'Snacks',    icon: '🥗', allowKey: 'allowSnacks',    maxKey: 'snacksNumber'     },
];

export default function NewSubscription() {
  const { lang, t, isAr } = useLang();
  const { governorates: govData } = useGovernorates();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [clientType, setClientType]         = useState(searchParams.get('clientId') ? 'existing' : 'new');
  const [clients, setClients]               = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearch, setClientSearch]     = useState('');
  const [packages, setPackages]             = useState([]);
  const [saving, setSaving]                 = useState(false);
  const [step, setStep]                     = useState(1);
  const [msg, setMsg]                       = useState('');
  const [pricing, setPricing]               = useState(null);
  const [flexSettings, setFlexSettings]     = useState(DEFAULT_FLEX_SETTINGS);

  const [newClientForm, setNewClientForm] = useState({
    name: searchParams.get('clientName') || '',
    phone: searchParams.get('clientPhone') || '',
    email: '', gender: '', allergy: '', deliveryPeriod: '',
    governorate: '', governorateEn: '', region: '', regionEn: '',
    block: '', street: '', alley: '', building: '', floor: '', apartment: '',
  });

  const [subForm, setSubForm] = useState({
    bundleType: 'normal', packageId: '', startDate: '',
    durationWeeks: 4, durationDays: null,
    protein: '150', carbs: '100',
    mealsNumber: 3, snacksNumber: 1,
    allowBreakfast: true, allowedBreakfast: 1,
    allowLunch:     true, allowedLunch:     1,
    allowDinner:    true, allowedDinner:    1,
    allowSnacks:    true,
    deliveryDays: [0, 1, 2, 3, 4, 5],
    paymentMethod: 'كاش / Cash', paymentAmount: '', notes: '',
  });

  // ── كوبون الخصم ──
  const [couponCode, setCouponCode]   = useState('');
  const [couponData, setCouponData]   = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const applyCoupon = async () => {
    if (!couponCode) return;
    setCouponLoading(true); setCouponError(''); setCouponData(null);
    const result = await validateCoupon(couponCode, {
      packageId: subForm.packageId,
      durationWeeks: subForm.durationWeeks,
      bundleType: subForm.bundleType,
    });
    if (result.valid) {
      setCouponData(result.coupon);
    } else {
      setCouponError(result.error);
    }
    setCouponLoading(false);
  };

  const removeCoupon = () => { setCouponData(null); setCouponCode(''); setCouponError(''); };

  useEffect(() => {
    Promise.all([
      getClients(), getPackages(), getPricingSettings(), getFlexSettings(),
      getDoc(doc(db, 'appConfig', 'autoSelectSettings')).catch(()=>null)
    ]).then(([c, p, pr, fs, settingsSnap]) => {
      setClients(c); setPackages(p); setPricing(pr);
      if (fs) setFlexSettings(fs);

      // حساب تاريخ البداية بناءً على subscriptionLeadHours
      const leadHours = settingsSnap?.exists?.() ? (settingsSnap.data().subscriptionLeadHours || 72) : 72;
      const defaultStart = new Date(Date.now() + leadHours * 60 * 60 * 1000).toISOString().split('T')[0];
      setSubForm(prev => ({ ...prev, startDate: defaultStart }));

      const cId = searchParams.get('clientId');
      if (cId) {
        const found = c.find(x => x.id === cId);
        if (found) { setSelectedClient(found); setStep(2); }
      }
    });
  }, []);

  const updateNew = (k, v) => setNewClientForm(p => ({ ...p, [k]: v }));
  const updateSub = (k, v) => setSubForm(p => ({ ...p, [k]: v }));

  // حساب تاريخ الانتهاء بناءً على أيام التوصيل الفعلية
  const calcEndDateWithDeliveryDays = (start, targetDeliveryDays, deliveryDays) => {
    if (!start || !targetDeliveryDays) return '';
    const activeDays = deliveryDays && deliveryDays.length > 0 ? deliveryDays : [0,1,2,3,4,5];
    let count = 0;
    const d = new Date(start);
    // نمشي يوم يوم ونحسب كم يوم توصيل فعلي عدى
    for (let i = 0; i < 365; i++) {
      const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
      // تحويل من JS day إلى ترتيبنا (السبت=0 ... الجمعة=6)
      const ourDay = dayOfWeek === 0 ? 1 : dayOfWeek === 6 ? 0 : dayOfWeek;
      if (activeDays.includes(ourDay)) {
        count++;
        if (count >= targetDeliveryDays) break;
      }
      d.setDate(d.getDate() + 1);
    }
    return d.toISOString().split('T')[0];
  };

  const calcEndDate = (start, weeks, days = null) => {
    if (!start) return '';
    const targetDays = days || (weeks || 4) * 7;
    // لو الباقة مرنة وفيه أيام توصيل محددة → احسب بناءً عليها
    if (subForm.bundleType === 'custom' && subForm.deliveryDays?.length > 0) {
      return calcEndDateWithDeliveryDays(start, targetDays, subForm.deliveryDays);
    }
    // باقة ثابتة → حساب عادي
    const d = new Date(start);
    d.setDate(d.getDate() + targetDays);
    return d.toISOString().split('T')[0];
  };

  const getTotalDays = () => subForm.durationDays || (subForm.durationWeeks || 4) * 7;
  const getCalcPrice  = () => {
    if (!pricing || subForm.bundleType !== 'custom') return null;
    return calcCustomPrice(subForm, pricing, getTotalDays());
  };

  const govOptions    = govData.map(g => ({ key: g.id, label: isAr ? g.nameAr : g.nameEn, nameAr: g.nameAr, nameEn: g.nameEn }));
  const selectedGovObj = govData.find(g => g.nameAr === newClientForm.governorate || g.nameEn === newClientForm.governorate || g.id === newClientForm.governorate);
  const regionOptions = selectedGovObj
    ? (selectedGovObj.regions || []).filter(r => r.active !== false).map(r => ({ label: isAr ? r.nameAr : r.nameEn, nameAr: r.nameAr, nameEn: r.nameEn }))
    : [];

  const handleSaveClient = async () => {
    if (!newClientForm.name || !newClientForm.phone) { alert(isAr ? 'الاسم والهاتف مطلوبان' : 'Name and phone required'); return; }
    setSaving(true);
    const clientCode = 'C' + Date.now().toString().slice(-5);
    const id = await addClient({ ...newClientForm, clientCode });
    const updated = await getClients();
    setSelectedClient(updated.find(c => c.id === id));
    setSaving(false);
    setStep(2);
  };

  const handleSave = async () => {
    if (!subForm.startDate) { alert(isAr ? 'تاريخ البدء مطلوب' : 'Start date required'); return; }
    setSaving(true);
    try {
      await updateClient(selectedClient.id, {
        governorate:    newClientForm.governorate    || selectedClient.governorate,
        governorateEn:  newClientForm.governorateEn  || selectedClient.governorateEn,
        region:         newClientForm.region         || selectedClient.region,
        regionEn:       newClientForm.regionEn       || selectedClient.regionEn,
        block:          newClientForm.block          || selectedClient.block,
        street:         newClientForm.street         || selectedClient.street,
        alley:          newClientForm.alley          || selectedClient.alley,
        building:       newClientForm.building       || selectedClient.building,
        floor:          newClientForm.floor          || selectedClient.floor,
        apartment:      newClientForm.apartment      || selectedClient.apartment,
        allergy:        newClientForm.allergy        || selectedClient.allergy,
        deliveryPeriod: newClientForm.deliveryPeriod || selectedClient.deliveryPeriod,
      });

      const pkg     = packages.find(p => p.id === subForm.packageId);
      const endDate = calcEndDate(subForm.startDate, subForm.durationWeeks, subForm.durationDays);

      // حساب الخصم
      const originalPrice  = Number(subForm.paymentAmount) || 0;
      const discountAmount = couponData ? calcDiscount(couponData, originalPrice) : 0;
      const finalPrice     = originalPrice - discountAmount;

      const subRef = await addSubscription({
        clientId: selectedClient.id, clientName: selectedClient.name,
        clientCode: selectedClient.clientCode,
        packageId:   subForm.packageId,
        packageName: isAr ? (pkg?.nameAr || 'باقة مخصصة') : (pkg?.nameEn || 'Custom Bundle'),
        bundleType:  subForm.bundleType,
        startDate:   subForm.startDate, endDate,
        durationWeeks: subForm.durationWeeks, durationDays: subForm.durationDays,
        protein: subForm.protein, carbs: subForm.carbs,
        mealsNumber: subForm.mealsNumber, snacksNumber: subForm.snacksNumber,
        allowBreakfast: subForm.allowBreakfast, allowedBreakfast: subForm.allowedBreakfast,
        allowLunch:     subForm.allowLunch,     allowedLunch:     subForm.allowedLunch,
        allowDinner:    subForm.allowDinner,    allowedDinner:    subForm.allowedDinner,
        allowSnacks:    subForm.allowSnacks,
        deliveryDays:   subForm.deliveryDays,
        fridays:        subForm.fridays === true,
        payments: subForm.paymentMethod !== 'آجل / Credit' && subForm.paymentAmount ? [{
          method: subForm.paymentMethod, amount: finalPrice,
          date: new Date().toISOString().split('T')[0],
        }] : [],
        paymentStatus: subForm.paymentMethod === 'آجل / Credit' ? 'pending' : 'paid',
        notes: subForm.notes, status: 'active',
        // بيانات الكوبون
        ...(couponData ? {
          couponCode:     couponData.code,
          couponId:       couponData.id,
          originalPrice,
          discountAmount,
          finalPrice,
        } : {}),
      });

      // تسجيل استخدام الكوبون
      if (couponData) {
        await recordCouponUsage(couponData.id, {
          subscriptionId: subRef.id,
          clientId:    selectedClient.id,
          clientName:  selectedClient.name,
          clientCode:  selectedClient.clientCode,
          packageName: isAr ? (pkg?.nameAr || 'باقة مخصصة') : (pkg?.nameEn || 'Custom Bundle'),
          couponCode:  couponData.code,
          originalPrice,
          discountAmount,
          finalPrice,
          startDate: subForm.startDate,
        });
      }

      setMsg(isAr ? '✅ تم إنشاء الاشتراك بنجاح!' : '✅ Subscription created successfully!');
      setTimeout(() => navigate(`/clients/${selectedClient.id}`), 1500);
    } catch (err) { alert('Error: ' + err.message); }
    setSaving(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{isAr ? 'إنشاء اشتراك جديد' : 'New Subscription'}</h2>
          <div className="breadcrumb">{isAr ? 'الاشتراكات / جديد' : 'Subscriptions / New'}</div>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        {/* Steps indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          {[{ n: 1, label: isAr ? 'العميل' : 'Client' }, { n: 2, label: isAr ? 'العنوان' : 'Address' }, { n: 3, label: isAr ? 'الاشتراك' : 'Subscription' }].map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                onClick={() => step > s.n && setStep(s.n)}
                style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.88rem', cursor: step > s.n ? 'pointer' : 'default', background: step >= s.n ? '#0d9488' : '#e2e8f0', color: step >= s.n ? 'white' : '#94a3b8' }}
              >
                {step > s.n ? '✓' : s.n}
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: step === s.n ? 700 : 400, color: step === s.n ? '#0d9488' : '#64748b' }}>{s.label}</span>
              {i < 2 && <div style={{ width: '40px', height: '2px', background: step > s.n ? '#0d9488' : '#e2e8f0' }} />}
            </div>
          ))}
        </div>

        {/* ─── STEP 1 ─── */}
        {step === 1 && (
          <div className="card" style={{ maxWidth: '700px' }}>
            <div className="card-header"><h3>{isAr ? 'اختيار العميل' : 'Select Client'}</h3></div>
            <div className="card-body">
              <div className="radio-group" style={{ marginBottom: '20px' }}>
                <div className="radio-option">
                  <input type="radio" id="ct-new" name="ct" checked={clientType === 'new'} onChange={() => { setClientType('new'); setSelectedClient(null); }} />
                  <label htmlFor="ct-new">{isAr ? 'عميل جديد' : 'New Client'}</label>
                </div>
                <div className="radio-option">
                  <input type="radio" id="ct-existing" name="ct" checked={clientType === 'existing'} onChange={() => setClientType('existing')} />
                  <label htmlFor="ct-existing">{isAr ? 'عميل حالي' : 'Existing Client'}</label>
                </div>
              </div>

              {clientType === 'new' && (
                <div className="fade-in">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">{isAr ? 'الاسم الكامل' : 'Full Name'} *</label>
                      <input className="form-control" value={newClientForm.name} onChange={e => updateNew('name', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{isAr ? 'رقم الهاتف' : 'Phone'} *</label>
                      <input className="form-control" value={newClientForm.phone} onChange={e => updateNew('phone', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
                      <input className="form-control" type="email" value={newClientForm.email} onChange={e => updateNew('email', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{isAr ? 'الجنس' : 'Gender'}</label>
                      <select className="form-control" value={newClientForm.gender} onChange={e => updateNew('gender', e.target.value)}>
                        <option value="">--</option>
                        <option value="male">{isAr ? 'ذكر' : 'Male'}</option>
                        <option value="female">{isAr ? 'أنثى' : 'Female'}</option>
                      </select>
                    </div>
                    <div className="form-group full-width">
                      <label className="form-label">{isAr ? 'الموانع الغذائية' : 'Food Restrictions'}</label>
                      <textarea className="form-control" value={newClientForm.allergy} onChange={e => updateNew('allergy', e.target.value)} style={{ minHeight: '70px' }} />
                    </div>
                  </div>
                  <button className="btn btn-primary btn-full" style={{ marginTop: '16px' }} onClick={handleSaveClient} disabled={saving}>
                    {saving ? t.loading : (isAr ? 'التالي: العنوان ←' : 'Next: Address →')}
                  </button>
                </div>
              )}

              {clientType === 'existing' && (
                <div className="fade-in">
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">{isAr ? 'ابحث عن العميل' : 'Search Client'}</label>
                    <input className="form-control" placeholder={isAr ? 'اسم او هاتف او كود...' : 'Name, phone or code...'} value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
                  </div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    {clients.filter(c => c.name?.includes(clientSearch) || c.phone?.includes(clientSearch) || c.clientCode?.includes(clientSearch)).map(c => (
                      <div key={c.id}
                        onClick={() => { setSelectedClient(c); setNewClientForm(p => ({ ...p, allergy: c.allergy || '', deliveryPeriod: c.deliveryPeriod || '', governorate: c.governorate || '', region: c.region || '', block: c.block || '', street: c.street || '', alley: c.alley || '', building: c.building || '', floor: c.floor || '', apartment: c.apartment || '' })); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', background: selectedClient?.id === c.id ? '#f0fdfa' : 'white', borderBottom: '1px solid #f1f5f9' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: selectedClient?.id === c.id ? '#0d9488' : '#e2e8f0', color: selectedClient?.id === c.id ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                            {c.name?.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.phone} • {c.clientCode}</div>
                          </div>
                        </div>
                        {selectedClient?.id === c.id && <span style={{ color: '#0d9488', fontWeight: 700 }}>✓</span>}
                      </div>
                    ))}
                  </div>
                  {selectedClient && (
                    <button className="btn btn-primary btn-full" style={{ marginTop: '16px' }} onClick={() => setStep(2)}>
                      {isAr ? 'التالي: تأكيد العنوان ←' : 'Next: Confirm Address →'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── STEP 2 ─── */}
        {step === 2 && selectedClient && (
          <div className="card" style={{ maxWidth: '700px' }}>
            <div className="card-header">
              <h3>📍 {isAr ? 'بيانات التوصيل' : 'Delivery Details'} — {selectedClient.name}</h3>
            </div>
            <div className="card-body">
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">{isAr ? 'الموانع الغذائية' : 'Food Restrictions'}</label>
                <textarea className="form-control" value={newClientForm.allergy} onChange={e => updateNew('allergy', e.target.value)} style={{ minHeight: '70px' }} />
              </div>
              <div className="section-title">{isAr ? 'العنوان التفصيلي' : 'Detailed Address'}</div>
              <div className="form-grid" style={{ marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">{isAr ? 'المحافظة' : 'Governorate'}</label>
                  <select className="form-control" value={newClientForm.governorate}
                    onChange={e => {
                      const gov = govData.find(g => g.nameAr === e.target.value || g.nameEn === e.target.value || g.id === e.target.value);
                      updateNew('governorate', isAr ? (gov?.nameAr || e.target.value) : (gov?.nameEn || e.target.value));
                      updateNew('governorateEn', gov?.nameEn || '');
                      updateNew('region', ''); updateNew('regionEn', '');
                    }}>
                    <option value="">--</option>
                    {govOptions.map(g => <option key={g.key} value={isAr ? g.nameAr : g.nameEn}>{g.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{isAr ? 'المنطقة' : 'Region'}</label>
                  <select className="form-control" value={newClientForm.region}
                    onChange={e => { const r = regionOptions.find(x => x.nameAr === e.target.value || x.nameEn === e.target.value); updateNew('region', r?.nameAr || e.target.value); updateNew('regionEn', r?.nameEn || e.target.value); }}>
                    <option value="">--</option>
                    {regionOptions.map((r, i) => <option key={i} value={isAr ? r.nameAr : r.nameEn}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-grid col-4" style={{ marginBottom: '16px' }}>
                {[['block','القطعة','Block'],['street','الشارع','Street'],['alley','الجادة','Alley'],['building','المنزل','House']].map(([k, ar, en]) => (
                  <div key={k} className="form-group">
                    <label className="form-label">{isAr ? ar : en}</label>
                    <input className="form-control" value={newClientForm[k]} onChange={e => updateNew(k, e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="form-grid" style={{ marginBottom: '20px' }}>
                {[['floor','الدور','Floor'],['apartment','الشقة','Apt']].map(([k, ar, en]) => (
                  <div key={k} className="form-group">
                    <label className="form-label">{isAr ? ar : en}</label>
                    <input className="form-control" value={newClientForm[k]} onChange={e => updateNew(k, e.target.value)} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-ghost" onClick={() => setStep(1)}>{isAr ? '→ رجوع' : '← Back'}</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(3)}>{isAr ? 'التالي: الاشتراك ←' : 'Next: Subscription →'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 3 ─── */}
        {step === 3 && selectedClient && (
          <div style={{ maxWidth: '700px' }}>
            {/* Client bar */}
            <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0d9488', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem' }}>
                {selectedClient.name?.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{selectedClient.name}</div>
                <div style={{ fontSize: '0.78rem', color: '#0f766e' }}>{selectedClient.phone} • {selectedClient.clientCode}</div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginRight: 'auto' }} onClick={() => setStep(1)}>
                {isAr ? 'تغيير العميل' : 'Change Client'}
              </button>
            </div>

            <div className="card">
              <div className="card-header"><h3>{isAr ? 'تفاصيل الاشتراك' : 'Subscription Details'}</h3></div>
              <div className="card-body">

                {/* نوع الباقة */}
                <div className="section-title">{isAr ? 'نوع الباقة' : 'Bundle Type'}</div>
                <div className="radio-group" style={{ marginBottom: '20px' }}>
                  <div className="radio-option">
                    <input type="radio" id="bt-normal" name="bt" checked={subForm.bundleType === 'normal'} onChange={() => updateSub('bundleType', 'normal')} />
                    <label htmlFor="bt-normal">{isAr ? 'باقة ثابتة' : 'Normal Bundle'}</label>
                  </div>
                  <div className="radio-option">
                    <input type="radio" id="bt-custom" name="bt" checked={subForm.bundleType === 'custom'} onChange={() => updateSub('bundleType', 'custom')} />
                    <label htmlFor="bt-custom">{isAr ? 'باقة مرنة' : 'Custom Bundle'}</label>
                  </div>
                </div>

                {/* باقة ثابتة */}
                {subForm.bundleType === 'normal' && (
                  <div style={{ marginBottom: '16px' }}>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label className="form-label">{isAr ? 'اختر الباقة' : 'Select Package'}</label>
                      <select className="form-control" value={subForm.packageId}
                        onChange={e => {
                          const pkg = packages.find(p => p.id === e.target.value);
                          updateSub('packageId', e.target.value);
                          if (pkg) {
                            updateSub('protein',          pkg.protein          || '150');
                            updateSub('carbs',            pkg.carbohydrates    || '100');
                            updateSub('mealsNumber',      pkg.mealsNumber      || 3);
                            updateSub('snacksNumber',     pkg.snacksNumber     || 1);
                            updateSub('allowBreakfast',   pkg.mealTypes?.breakfast !== false);
                            updateSub('allowLunch',       pkg.mealTypes?.lunch     !== false);
                            updateSub('allowDinner',      pkg.mealTypes?.dinner    !== false);
                            updateSub('allowedBreakfast', pkg.allowedBreakfast || 1);
                            updateSub('allowedLunch',     pkg.allowedLunch     || 1);
                            updateSub('allowedDinner',    pkg.allowedDinner    || 1);
                            updateSub('fridays',          pkg.fridays === true);
                            const fp = pkg.prices?.[0];
                            if (fp) updateSub('paymentAmount', fp.price || '');
                          }
                        }}>
                        <option value="">-- {isAr ? 'اختر' : 'Select'} --</option>
                        {packages.map(p => <option key={p.id} value={p.id}>{isAr ? p.nameAr : p.nameEn}</option>)}
                      </select>
                    </div>
                    {subForm.packageId && (() => {
                      const pkg    = packages.find(p => p.id === subForm.packageId);
                      const prices = pkg?.prices || [];
                      if (!prices.length) return null;
                      return (
                        <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '8px', padding: '12px 16px' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f766e', marginBottom: '8px' }}>💰 {isAr ? 'أسعار الباقة' : 'Package Prices'}</div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {prices.map((pr, i) => (
                              <button key={i} type="button" onClick={() => updateSub('paymentAmount', pr.price)}
                                style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-main)', fontWeight: 700, fontSize: '0.85rem', background: String(subForm.paymentAmount) === String(pr.price) ? '#0d9488' : '#e2e8f0', color: String(subForm.paymentAmount) === String(pr.price) ? 'white' : '#374151' }}>
                                {pr.duration}: {pr.price} KWD
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* باقة مرنة */}
                {subForm.bundleType === 'custom' && (() => {
                  const totalMeals =
                    (subForm.allowBreakfast !== false ? subForm.allowedBreakfast || 1 : 0) +
                    (subForm.allowLunch     !== false ? subForm.allowedLunch     || 1 : 0) +
                    (subForm.allowDinner    !== false ? subForm.allowedDinner    || 1 : 0);
                  const minDays = flexSettings.minDaysPerWeek || 5;
                  const maxDays = flexSettings.maxDaysPerWeek || 6;
                  const daysCount = (subForm.deliveryDays || []).length;
                  const mealsOk = totalMeals >= (flexSettings.minMealsPerDay||2) && totalMeals <= (flexSettings.maxMealsPerDay||5);
                  const daysOk  = daysCount >= minDays && daysCount <= maxDays;
                  return (
                  <div className="fade-in" style={{ marginBottom: '16px' }}>

                    {/* البروتين */}
                    <FSection icon="🍗" title={isAr ? 'البروتين (جرام)' : 'Protein (g)'}>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                        {(flexSettings.allowedProtein || PROTEIN_OPTIONS).map(v => (
                          <FChip key={v} label={`${v}g`}
                            active={String(subForm.protein) === String(v)}
                            color="#c2410c" onClick={() => updateSub('protein', String(v))} />
                        ))}
                      </div>
                    </FSection>

                    {/* الكارب */}
                    <FSection icon="🍚" title={isAr ? 'الكارب (جرام)' : 'Carbs (g)'}>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                        {(flexSettings.allowedCarbs || CARBS_OPTIONS).map(v => (
                          <FChip key={v} label={`${v}g`}
                            active={String(subForm.carbs) === String(v)}
                            color="#92400e" onClick={() => updateSub('carbs', String(v))} />
                        ))}
                      </div>
                    </FSection>

                    {/* الوجبات */}
                    <FSection icon="🍽️" title={`${isAr?'الوجبات اليومية':'Daily Meals'} (${flexSettings.minMealsPerDay||2}–${flexSettings.maxMealsPerDay||5})`}>
                      {!mealsOk && totalMeals > 0 && (
                        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:7,
                          padding:'6px 10px', marginBottom:8, fontSize:'0.76rem', color:'#dc2626' }}>
                          ⚠️ {isAr?`الوجبات يجب بين ${flexSettings.minMealsPerDay||2} و ${flexSettings.maxMealsPerDay||5}`:`Meals must be between ${flexSettings.minMealsPerDay||2} and ${flexSettings.maxMealsPerDay||5}`}
                        </div>
                      )}
                      {[
                        { key:'breakfast', icon:'🌅', label:isAr?'فطور':'Breakfast', allowKey:'allowBreakfast', maxKey:'allowedBreakfast', max:2 },
                        { key:'lunch',     icon:'☀️',  label:isAr?'غداء':'Lunch',     allowKey:'allowLunch',     maxKey:'allowedLunch',     max:3 },
                        { key:'dinner',    icon:'🌙', label:isAr?'عشاء':'Dinner',    allowKey:'allowDinner',    maxKey:'allowedDinner',    max:2 },
                        { key:'snacks',    icon:'🥗', label:isAr?'سناك':'Snacks',    allowKey:'allowSnacks',    maxKey:'snacksNumber',     max:flexSettings.maxSnacks||3 },
                      ].filter(m => m.key !== 'snacks' || (flexSettings.maxSnacks||3) > 0).map(m => (
                        <FMealRow key={m.key}
                          icon={m.icon} label={m.label}
                          enabled={subForm[m.allowKey] !== false}
                          count={subForm[m.maxKey] || 1}
                          max={m.max}
                          onToggle={() => updateSub(m.allowKey, subForm[m.allowKey] === false ? true : false)}
                          onCount={c => updateSub(m.maxKey, c)}
                        />
                      ))}
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 12px',
                        borderRadius:8, marginTop:4, fontSize:'0.82rem', fontWeight:700,
                        background: mealsOk ? '#f0fdfa' : '#fef9c3',
                        border:`1px solid ${mealsOk?'#ccfbf1':'#fde68a'}` }}>
                        <span style={{ color:'#64748b' }}>{isAr?'إجمالي الوجبات:':'Total Meals:'}</span>
                        <span style={{ color: mealsOk ? '#0d9488' : '#b45309' }}>
                          {totalMeals} {isAr?'وجبة':'meals'}
                          {subForm.allowSnacks !== false && ` + ${subForm.snacksNumber||1} ${isAr?'سناك':'snacks'}`}
                        </span>
                      </div>
                    </FSection>

                    {/* أيام التوصيل */}
                    <FSection icon="📅"
                      title={`${isAr?'أيام التوصيل':'Delivery Days'} — ${isAr?`${minDays}–${maxDays} أيام`:`${minDays}–${maxDays} days`}`}>
                      <div style={{ fontSize:'0.74rem', color:'#64748b', marginBottom:8, display:'flex', gap:8, alignItems:'center' }}>
                        <span>{isAr?'محدد:':'Selected:'} <strong style={{ color:'#0d9488' }}>{daysCount}</strong> {isAr?'يوم':'days'}</span>
                        {!daysOk && daysCount > 0 && (
                          <span style={{ color:'#dc2626' }}>⚠️ {isAr?`لازم ${minDays} أيام على الأقل`:`Min ${minDays} days required`}</span>
                        )}
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5 }}>
                        {DAYS_AR.map((day, idx) => {
                          const active   = (subForm.deliveryDays||[]).includes(idx);
                          const atMin    = daysCount <= minDays && active;
                          const atMax    = daysCount >= maxDays && !active;
                          const disabled = atMin || atMax;
                          return (
                            <button key={idx} type="button"
                              title={day}
                              onClick={() => {
                                if (disabled) return;
                                const days = subForm.deliveryDays || [];
                                updateSub('deliveryDays', active ? days.filter(d=>d!==idx) : [...days,idx].sort());
                              }}
                              style={{
                                padding:'9px 2px', borderRadius:8, fontFamily:'var(--font-main)',
                                fontWeight:800, fontSize:'0.72rem', cursor:disabled&&!active?'not-allowed':'pointer',
                                border:`2px solid ${active?'#0d9488':'#e2e8f0'}`,
                                background: active?'#0d9488':'white',
                                color: active?'white': disabled?'#cbd5e1':'#374151',
                                opacity: disabled&&!active ? 0.4 : 1,
                                transition:'all 0.15s',
                              }}>
                              {day.slice(0,3)}
                            </button>
                          );
                        })}
                      </div>
                      {daysCount > 0 && (
                        <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:5 }}>
                          {DAYS_AR.map((day,idx) => (subForm.deliveryDays||[]).includes(idx) && (
                            <span key={idx} style={{ background:'#f0fdfa', color:'#0d9488', border:'1px solid #ccfbf1',
                              borderRadius:99, padding:'2px 9px', fontSize:'0.72rem', fontWeight:700 }}>{day}</span>
                          ))}
                        </div>
                      )}
                    </FSection>

                    {/* المدة — chips */}
                    <FSection icon="🗓️" title={isAr ? 'مدة الاشتراك' : 'Duration'}>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                        {(flexSettings.allowedDurations || [7,14,21,28,35,42,56,84]).sort((a,b)=>a-b).map(d => {
                          const currentDays = subForm.durationDays || (subForm.durationWeeks||4)*7;
                          return (
                            <FChip key={d}
                              label={DURATION_LABELS[d] || `${d} ${isAr?'يوم':'days'}`}
                              active={currentDays === d}
                              color="#7c3aed"
                              onClick={() => { updateSub('durationDays', d); updateSub('durationWeeks', null); }}
                            />
                          );
                        })}
                      </div>
                    </FSection>

                    {/* حساب السعر التلقائي */}
                    {(() => {
                      const calc = getCalcPrice();
                      if (!calc) return null;
                      return (
                        <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f766e', marginBottom: '10px' }}>
                            🧮 {isAr ? 'حساب السعر التلقائي' : 'Auto Price Calculation'}
                            <span style={{ fontSize: '0.72rem', fontWeight: 400, marginRight: '8px', color: '#64748b' }}>({calc.days} {isAr ? 'يوم' : 'days'} × {calc.grams}g)</span>
                          </div>
                          {[
                            { icon: '🍳', label: isAr ? 'الفطور'        : 'Breakfast',   val: calc.breakfastCost, show: subForm.allowBreakfast !== false },
                            { icon: '🍛', label: isAr ? 'الغداء'        : 'Lunch',       val: calc.lunchCost,     show: subForm.allowLunch     !== false },
                            { icon: '🌙', label: isAr ? 'العشاء'        : 'Dinner',      val: calc.dinnerCost,    show: subForm.allowDinner    !== false },
                            { icon: '🥗', label: isAr ? 'السناك'        : 'Snacks',      val: calc.snackCost,     show: subForm.allowSnacks    !== false },
                            { icon: '🚗', label: isAr ? 'مصاريف ثابتة' : 'Fixed Costs', val: calc.fixedCost,     show: true },
                          ].filter(r => r.show).map((r, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '3px 0', borderBottom: '1px dashed #ccfbf1' }}>
                              <span style={{ color: '#374151' }}>{r.icon} {r.label}</span>
                              <span style={{ fontWeight: 600, color: '#0f766e' }}>{r.val.toFixed(3)} KWD</span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '8px', borderTop: '2px solid #0d9488' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{isAr ? 'الإجمالي' : 'Total'}</span>
                            <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0d9488' }}>{calc.total.toFixed(3)} KWD</span>
                          </div>
                          <button type="button" className="btn btn-outline btn-sm"
                            style={{ width: '100%', marginTop: '10px', color: '#0d9488', borderColor: '#0d9488' }}
                            onClick={() => updateSub('paymentAmount', calc.total.toFixed(3))}>
                            {isAr ? '✅ استخدام هذا السعر' : '✅ Use This Price'}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                  );
                })()}

                {/* المدة */}
                <div className="section-title">{isAr ? 'مدة الاشتراك' : 'Duration'}</div>
                <div className="form-grid" style={{ marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">{isAr ? 'تاريخ البدء' : 'Start Date'} *</label>
                    <input className="form-control" type="date" value={subForm.startDate} onChange={e => updateSub('startDate', e.target.value)} />
                    <div style={{ fontSize:'0.72rem', color:'#0d9488', marginTop:4 }}>
                      📅 {isAr ? 'محسوب تلقائياً من إعدادات ساعات الاشتراك — يمكن تعديله' : 'Auto-calculated from subscription lead hours — editable'}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{isAr ? 'المدة' : 'Duration'}</label>
                    <select className="form-control"
                      value={subForm.durationDays ? `days_${subForm.durationDays}` : `weeks_${subForm.durationWeeks}`}
                      onChange={e => {
                        const val = e.target.value;
                        if (val.startsWith('days_')) { updateSub('durationDays', parseInt(val.split('_')[1])); updateSub('durationWeeks', null); }
                        else { updateSub('durationWeeks', parseInt(val.split('_')[1])); updateSub('durationDays', null); }
                      }}>
                      <option value="weeks_1">{isAr  ? '1 أسبوع'           : '1 Week'}</option>
                      <option value="weeks_2">{isAr  ? '2 أسبوع'           : '2 Weeks'}</option>
                      <option value="weeks_3">{isAr  ? '3 أسابيع'          : '3 Weeks'}</option>
                      <option value="days_26">{isAr  ? '26 يوم (شهر)'      : '26 Days (Month)'}</option>
                      <option value="weeks_4">{isAr  ? '4 أسابيع (28 يوم)' : '4 Weeks (28 Days)'}</option>
                      <option value="weeks_6">{isAr  ? '6 أسابيع'          : '6 Weeks'}</option>
                      <option value="weeks_8">{isAr  ? '8 أسابيع'          : '8 Weeks'}</option>
                      <option value="weeks_12">{isAr ? '12 أسبوع'          : '12 Weeks'}</option>
                    </select>
                  </div>
                  {subForm.startDate && (
                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                      <label className="form-label">{isAr ? 'تاريخ الانتهاء' : 'End Date'}</label>
                      <input className="form-control" readOnly value={calcEndDate(subForm.startDate, subForm.durationWeeks, subForm.durationDays)} style={{ background: '#f0fdfa', color: '#0f766e', fontWeight: 700 }} />
                    </div>
                  )}
                </div>

                {/* الدفع */}
                <div className="section-title">{isAr ? 'الدفع' : 'Payment'}</div>
                <div className="form-grid" style={{ marginBottom: '20px' }}>
                  <div className="form-group">
                    <label className="form-label">{isAr ? 'طريقة الدفع' : 'Payment Method'}</label>
                    <select className="form-control" value={subForm.paymentMethod} onChange={e => updateSub('paymentMethod', e.target.value)}>
                      {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  {subForm.paymentMethod !== 'آجل / Credit' && (
                    <div className="form-group">
                      <label className="form-label">{isAr ? 'المبلغ (KWD)' : 'Amount (KWD)'}</label>
                      <input className="form-control" type="number" placeholder="0.000" value={subForm.paymentAmount} onChange={e => updateSub('paymentAmount', e.target.value)} />
                    </div>
                  )}
                </div>

                {/* كوبون الخصم */}
                <div className="section-title">🎟 {isAr ? 'كوبون الخصم' : 'Discount Coupon'}</div>
                <div style={{ marginBottom:'20px' }}>
                  {!couponData ? (
                    <div style={{ display:'flex', gap:'10px', alignItems:'flex-end' }}>
                      <div className="form-group" style={{ flex:1, marginBottom:0 }}>
                        <label className="form-label">{isAr?'كود الخصم (اختياري)':'Coupon Code (optional)'}</label>
                        <input className="form-control"
                          value={couponCode}
                          onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                          placeholder="SUMMER25"
                          style={{ fontFamily:'monospace', fontWeight:700, letterSpacing:'2px' }}
                          onKeyDown={e => e.key==='Enter' && applyCoupon()} />
                        {couponError && <div style={{ color:'#dc2626', fontSize:'0.78rem', marginTop:'4px' }}>❌ {couponError}</div>}
                      </div>
                      <button className="btn btn-outline" onClick={applyCoupon} disabled={couponLoading || !couponCode} style={{ padding:'10px 20px', whiteSpace:'nowrap' }}>
                        {couponLoading ? '...' : (isAr?'تطبيق':'Apply')}
                      </button>
                    </div>
                  ) : (
                    <div style={{ background:'#f0fdfa', border:'1px solid #0d9488', borderRadius:'10px', padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                          <span style={{ fontFamily:'monospace', fontWeight:800, fontSize:'1.1rem', color:'#0d9488', letterSpacing:'2px' }}>{couponData.code}</span>
                          <span style={{ background:'#dcfce7', color:'#16a34a', padding:'2px 8px', borderRadius:'6px', fontSize:'0.75rem', fontWeight:700 }}>✅ {isAr?'مطبّق':'Applied'}</span>
                        </div>
                        <div style={{ fontSize:'0.82rem', color:'#0f766e', marginTop:'4px' }}>
                          {couponData.discountType==='percentage'
                            ? `${isAr?'خصم':'Discount'} ${couponData.discountValue}%${couponData.maxDiscount?` (${isAr?'أقصى':'max'} ${couponData.maxDiscount} KWD)`:''}`
                            : `${isAr?'خصم':'Discount'} ${couponData.discountValue} KWD`}
                        </div>
                        {subForm.paymentAmount && (
                          <div style={{ fontSize:'0.82rem', color:'#7c3aed', fontWeight:700, marginTop:'4px' }}>
                            {isAr?'قيمة الخصم':'Discount amount'}: {calcDiscount(couponData, Number(subForm.paymentAmount)).toFixed(3)} KWD
                            {' → '}
                            {isAr?'الإجمالي':'Total'}: {(Number(subForm.paymentAmount) - calcDiscount(couponData, Number(subForm.paymentAmount))).toFixed(3)} KWD
                          </div>
                        )}
                      </div>
                      <button onClick={removeCoupon} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:'1.2rem' }}>✕</button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-ghost" onClick={() => setStep(2)}>{isAr ? '→ رجوع' : '← Back'}</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                    {saving ? t.loading : (isAr ? '✅ إنشاء الاشتراك' : '✅ Create Subscription')}
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
