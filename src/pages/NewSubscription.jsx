import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getClients, addClient, updateClient } from '../firebase/clientService';
import { addSubscription } from '../firebase/subscriptionService';
import { getPackages } from '../firebase/packageService';
import { useLang } from '../LanguageContext';
import { REGIONS_DATA } from '../LanguageContext';
import { getPricingSettings, calcCustomPrice } from '../firebase/pricingService';

const PAYMENT_METHODS = ['كاش / Cash', 'Knet', 'Visa/Mastercard', 'WhatsApp Link', 'آجل / Credit'];
const PROTEIN_OPTIONS = [100, 120, 150, 180, 200];
const CARBS_OPTIONS   = [50, 100, 150, 200];
const DAYS_AR = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
const DAYS_EN = ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'];
const MEAL_TYPES_CONFIG = [
  { key: 'breakfast', ar: 'الفطور', en: 'Breakfast', icon: '🍳', allowKey: 'allowBreakfast', maxKey: 'allowedBreakfast' },
  { key: 'lunch',     ar: 'الغداء', en: 'Lunch',     icon: '🍛', allowKey: 'allowLunch',     maxKey: 'allowedLunch'     },
  { key: 'dinner',    ar: 'العشاء', en: 'Dinner',    icon: '🌙', allowKey: 'allowDinner',    maxKey: 'allowedDinner'    },
  { key: 'snacks',    ar: 'السناك', en: 'Snacks',    icon: '🥗', allowKey: 'allowSnacks',    maxKey: 'snacksNumber'     },
];

export default function NewSubscription() {
  const { lang, t, isAr } = useLang();
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

  useEffect(() => {
    Promise.all([getClients(), getPackages(), getPricingSettings()]).then(([c, p, pr]) => {
      setClients(c); setPackages(p); setPricing(pr);
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

  const govOptions    = REGIONS_DATA.map(g => ({ key: g.key, label: isAr ? g.nameAr : g.nameEn, nameAr: g.nameAr, nameEn: g.nameEn }));
  const selectedGov   = REGIONS_DATA.find(g => g.key === newClientForm.governorate);
  const regionOptions = selectedGov ? selectedGov.regions.map(r => ({ label: isAr ? r.nameAr : r.nameEn, nameAr: r.nameAr, nameEn: r.nameEn })) : [];

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

      await addSubscription({
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
        payments: subForm.paymentMethod !== 'آجل / Credit' && subForm.paymentAmount ? [{
          method: subForm.paymentMethod, amount: subForm.paymentAmount,
          date: new Date().toISOString().split('T')[0],
        }] : [],
        paymentStatus: subForm.paymentMethod === 'آجل / Credit' ? 'pending' : 'paid',
        notes: subForm.notes, status: 'active',
      });

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
                    onChange={e => { const gov = REGIONS_DATA.find(g => g.key === e.target.value); updateNew('governorate', e.target.value); updateNew('governorateEn', gov?.nameEn || ''); updateNew('region', ''); updateNew('regionEn', ''); }}>
                    <option value="">--</option>
                    {govOptions.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
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
                {subForm.bundleType === 'custom' && (
                  <div className="fade-in" style={{ marginBottom: '16px' }}>
                    {/* الجرامات */}
                    <div className="form-grid" style={{ marginBottom: '16px' }}>
                      <div className="form-group">
                        <label className="form-label">{isAr ? 'البروتين' : 'Protein'}</label>
                        <select className="form-control" value={subForm.protein} onChange={e => updateSub('protein', e.target.value)}>
                          {PROTEIN_OPTIONS.map(p => <option key={p} value={p}>{p}g</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">{isAr ? 'الكارب' : 'Carbs'}</label>
                        <select className="form-control" value={subForm.carbs} onChange={e => updateSub('carbs', e.target.value)}>
                          {CARBS_OPTIONS.map(c => <option key={c} value={c}>{c}g</option>)}
                        </select>
                      </div>
                    </div>

                    {/* أنواع الوجبات */}
                    <div className="section-title" style={{ marginBottom: '10px' }}>{isAr ? 'أنواع الوجبات المسموحة' : 'Allowed Meal Types'}</div>
                    <div style={{ marginBottom: '16px' }}>
                      {MEAL_TYPES_CONFIG.map(mt => (
                        <div key={mt.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', marginBottom: '6px', background: subForm[mt.allowKey] !== false ? '#f0fdfa' : '#f8fafc', border: `1px solid ${subForm[mt.allowKey] !== false ? '#ccfbf1' : '#e2e8f0'}` }}>
                          <input type="checkbox" checked={subForm[mt.allowKey] !== false} onChange={e => updateSub(mt.allowKey, e.target.checked)} style={{ accentColor: '#0d9488', width: '18px', height: '18px', cursor: 'pointer' }} />
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', flex: 1 }}>{mt.icon} {isAr ? mt.ar : mt.en}</span>
                          {subForm[mt.allowKey] !== false && mt.key !== 'snacks' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{isAr ? 'الحد الأقصى:' : 'Max:'}</span>
                              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #0d9488', borderRadius: '8px', overflow: 'hidden' }}>
                                <button type="button"
                                  onClick={() => updateSub(mt.maxKey, Math.max(1, (subForm[mt.maxKey] || 1) - 1))}
                                  style={{ width: '36px', height: '36px', border: 'none', background: '#f0fdfa', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, color: '#0d9488' }}>
                                  −
                                </button>
                                <span style={{ width: '36px', textAlign: 'center', fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                                  {subForm[mt.maxKey] || 1}
                                </span>
                                <button type="button"
                                  onClick={() => updateSub(mt.maxKey, Math.min(5, (subForm[mt.maxKey] || 1) + 1))}
                                  style={{ width: '36px', height: '36px', border: 'none', background: '#f0fdfa', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, color: '#0d9488' }}>
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                          {subForm[mt.allowKey] !== false && mt.key === 'snacks' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{isAr ? 'العدد:' : 'Count:'}</span>
                              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #0d9488', borderRadius: '8px', overflow: 'hidden' }}>
                                <button type="button"
                                  onClick={() => updateSub('snacksNumber', Math.max(1, (subForm.snacksNumber || 1) - 1))}
                                  style={{ width: '36px', height: '36px', border: 'none', background: '#f0fdfa', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, color: '#0d9488' }}>
                                  −
                                </button>
                                <span style={{ width: '36px', textAlign: 'center', fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                                  {subForm.snacksNumber || 1}
                                </span>
                                <button type="button"
                                  onClick={() => updateSub('snacksNumber', Math.min(3, (subForm.snacksNumber || 1) + 1))}
                                  style={{ width: '36px', height: '36px', border: 'none', background: '#f0fdfa', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, color: '#0d9488' }}>
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: '#f1f5f9', borderRadius: '8px', marginTop: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
                        <span style={{ color: '#64748b' }}>{isAr ? 'إجمالي الوجبات اليومية:' : 'Total Daily Meals:'}</span>
                        <span style={{ color: '#0d9488' }}>
                          {(subForm.allowBreakfast !== false ? subForm.allowedBreakfast || 1 : 0) + (subForm.allowLunch !== false ? subForm.allowedLunch || 1 : 0) + (subForm.allowDinner !== false ? subForm.allowedDinner || 1 : 0)} {isAr ? 'وجبة' : 'meals'}
                          {subForm.allowSnacks !== false && ` + ${subForm.snacksNumber || 1} ${isAr ? 'سناك' : 'snacks'}`}
                        </span>
                      </div>
                    </div>

                    {/* أيام التوصيل */}
                    <div className="section-title" style={{ marginBottom: '10px' }}>{isAr ? 'أيام التوصيل' : 'Delivery Days'}</div>
                    <div className="days-grid" style={{ marginBottom: '16px' }}>
                      {DAYS_AR.map((day, idx) => (
                        <div key={idx} className="day-chip">
                          <input type="checkbox" id={`day-${idx}`}
                            checked={(subForm.deliveryDays || []).includes(idx)}
                            onChange={e => {
                              const days = subForm.deliveryDays || [];
                              updateSub('deliveryDays', e.target.checked ? [...days, idx].sort() : days.filter(d => d !== idx));
                            }} />
                          <label htmlFor={`day-${idx}`}>{isAr ? day : DAYS_EN[idx]}</label>
                        </div>
                      ))}
                    </div>

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
                )}

                {/* المدة */}
                <div className="section-title">{isAr ? 'مدة الاشتراك' : 'Duration'}</div>
                <div className="form-grid" style={{ marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">{isAr ? 'تاريخ البدء' : 'Start Date'} *</label>
                    <input className="form-control" type="date" value={subForm.startDate} onChange={e => updateSub('startDate', e.target.value)} />
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
