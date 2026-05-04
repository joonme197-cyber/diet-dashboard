import { useState, useEffect } from 'react';
import { getPricingSettings, savePricingSettings, DEFAULT_PRICING, getFlexSettings, saveFlexSettings, DEFAULT_FLEX_SETTINGS, DURATION_OPTIONS } from '../firebase/pricingService';
import { useLang } from '../LanguageContext';

export default function PricingSettings() {
  const { isAr } = useLang();
  const [pricing, setPricing]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [msg, setMsg]                   = useState('');
  const [flexSettings, setFlexSettings] = useState(DEFAULT_FLEX_SETTINGS);
  const [savingFlex, setSavingFlex]     = useState(false);
  const [msgFlex, setMsgFlex]           = useState('');

  useEffect(() => {
    Promise.all([getPricingSettings(), getFlexSettings()]).then(([p, f]) => {
      setPricing(p);
      setFlexSettings(f);
      setLoading(false);
    });
  }, []);

  const update = (k, v) => setPricing(p => ({ ...p, [k]: parseFloat(v) || 0 }));

  const handleSave = async () => {
    setSaving(true);
    await savePricingSettings(pricing);
    setSaving(false);
    setMsg('✅ ' + (isAr ? 'تم حفظ الأسعار بنجاح' : 'Prices saved successfully'));
    setTimeout(() => setMsg(''), 2500);
  };

  const handleReset = () => {
    setPricing({ ...DEFAULT_PRICING });
  };

  const handleSaveFlex = async () => {
    setSavingFlex(true);
    await saveFlexSettings(flexSettings);
    setSavingFlex(false);
    setMsgFlex('✅ ' + (isAr ? 'تم حفظ إعدادات الباقة المرنة' : 'Flex settings saved successfully'));
    setTimeout(() => setMsgFlex(''), 2500);
  };

  const updateFlex = (k, v) => setFlexSettings(f => ({ ...f, [k]: v }));

  const toggleFlexArray = (key, val) => {
    setFlexSettings(f => {
      const arr = f[key] || [];
      return { ...f, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val].sort((a, b) => a - b) };
    });
  };

  // مثال حساب لعرض تأثير الأسعار
  const exampleDays   = 26;
  const exampleGrams  = 150;
  const exampleBf     = 1;
  const exampleLn     = 1;
  const exampleDn     = 1;
  const exampleSn     = 1;

  const exPrice = pricing ? {
    bf:    pricing.breakfastPerGram * exampleGrams * exampleBf * exampleDays,
    ln:    pricing.lunchPerGram     * exampleGrams * exampleLn * exampleDays,
    dn:    pricing.dinnerPerGram    * exampleGrams * exampleDn * exampleDays,
    sn:    pricing.snackPerDay      * exampleSn               * exampleDays,
    fixed: pricing.fixedCostPerDay                            * exampleDays,
  } : null;

  const exTotal = exPrice ? Object.values(exPrice).reduce((s, v) => s + v, 0) : 0;

  if (loading) return <div className="loading"><div className="spinner" />{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>💰 {isAr ? 'إعدادات الأسعار' : 'Pricing Settings'}</h2>
          <div className="breadcrumb">
            {isAr ? 'أسعار الباقات المرنة — سعر الجرام لكل نوع وجبة' : 'Custom bundle pricing — price per gram per meal type'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-ghost" onClick={handleReset}>
            🔄 {isAr ? 'إعادة الضبط' : 'Reset'}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : `💾 ${isAr ? 'حفظ الأسعار' : 'Save Prices'}`}
          </button>
        </div>
      </div>

      {msg && <div style={{ margin: '0 32px' }}><div className="alert alert-success fade-in">{msg}</div></div>}

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

          {/* ── إعدادات الأسعار ── */}
          <div>
            {/* سعر الجرام */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header">
                <h3>🍽️ {isAr ? 'سعر الجرام لكل نوع وجبة' : 'Price per Gram per Meal Type'}</h3>
              </div>
              <div className="card-body">
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '16px', background: '#f0fdfa', padding: '10px 14px', borderRadius: '8px', border: '1px solid #ccfbf1' }}>
                  ℹ️ {isAr
                    ? 'السعر = سعر_الجرام × جرامات_البروتين × عدد_الوجبات × عدد_الأيام'
                    : 'Price = gram_rate × protein_grams × meals_count × days'}
                </div>

                {[
                  { key: 'breakfastPerGram', icon: '🍳', ar: 'الفطور', en: 'Breakfast', color: '#0d9488' },
                  { key: 'lunchPerGram',     icon: '🍛', ar: 'الغداء', en: 'Lunch',     color: '#7c3aed' },
                  { key: 'dinnerPerGram',    icon: '🌙', ar: 'العشاء', en: 'Dinner',    color: '#2563eb' },
                ].map(item => (
                  <div key={item.key} style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 16px', borderRadius: '10px', marginBottom: '10px',
                    border: '1.5px solid #e2e8f0', background: 'white',
                  }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                      background: `${item.color}15`, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '1.2rem',
                    }}>
                      {item.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>
                        {isAr ? item.ar : item.en}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {isAr ? 'KWD لكل جرام' : 'KWD per gram'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={pricing[item.key] ?? 0}
                        onChange={e => update(item.key, e.target.value)}
                        style={{
                          width: '100px', padding: '8px 12px', border: `1.5px solid ${item.color}40`,
                          borderRadius: '8px', fontFamily: 'var(--font-main)', fontSize: '0.95rem',
                          fontWeight: 700, textAlign: 'center', outline: 'none',
                          color: item.color,
                        }}
                        onFocus={e => e.target.style.borderColor = item.color}
                        onBlur={e => e.target.style.borderColor = `${item.color}40`}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>KWD/g</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* السناك والمصاريف الثابتة */}
            <div className="card">
              <div className="card-header">
                <h3>📦 {isAr ? 'السناك والمصاريف الثابتة' : 'Snacks & Fixed Costs'}</h3>
              </div>
              <div className="card-body">
                {[
                  {
                    key: 'snackPerDay', icon: '🥗',
                    ar: 'سعر السناك لليوم', en: 'Snack Price per Day',
                    desc: isAr ? 'KWD للسناك الواحد يومياً (بغض النظر عن الجرام)' : 'KWD per snack per day (regardless of grams)',
                    color: '#d97706',
                  },
                  {
                    key: 'fixedCostPerDay', icon: '🚗',
                    ar: 'المصروف الثابت لليوم', en: 'Fixed Cost per Day',
                    desc: isAr ? 'KWD يومياً (توصيل + إدارة + غيره)' : 'KWD per day (delivery + admin + others)',
                    color: '#dc2626',
                  },
                ].map(item => (
                  <div key={item.key} style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 16px', borderRadius: '10px', marginBottom: '10px',
                    border: '1.5px solid #e2e8f0', background: 'white',
                  }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                      background: `${item.color}15`, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '1.2rem',
                    }}>
                      {item.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>
                        {isAr ? item.ar : item.en}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{item.desc}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={pricing[item.key] ?? 0}
                        onChange={e => update(item.key, e.target.value)}
                        style={{
                          width: '100px', padding: '8px 12px', border: `1.5px solid ${item.color}40`,
                          borderRadius: '8px', fontFamily: 'var(--font-main)', fontSize: '0.95rem',
                          fontWeight: 700, textAlign: 'center', outline: 'none',
                          color: item.color,
                        }}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>KWD</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── مثال حساب تلقائي ── */}
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="card-header">
              <h3>🧮 {isAr ? 'مثال حساب تلقائي' : 'Auto Calculation Example'}</h3>
              <span className="badge badge-teal">{isAr ? 'يتحدث تلقائياً' : 'Live Preview'}</span>
            </div>
            <div className="card-body">
              {/* بيانات المثال */}
              <div style={{
                background: '#f8fafc', borderRadius: '8px', padding: '12px 16px',
                marginBottom: '20px', fontSize: '0.82rem', color: '#64748b',
                border: '1px solid #e2e8f0',
              }}>
                <strong style={{ color: '#374151' }}>{isAr ? 'بيانات المثال:' : 'Example Data:'}</strong>
                <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    `${isAr ? 'الأيام' : 'Days'}: ${exampleDays}`,
                    `${isAr ? 'البروتين' : 'Protein'}: ${exampleGrams}g`,
                    `${isAr ? 'فطور' : 'Breakfast'}: ×${exampleBf}`,
                    `${isAr ? 'غداء' : 'Lunch'}: ×${exampleLn}`,
                    `${isAr ? 'عشاء' : 'Dinner'}: ×${exampleDn}`,
                    `${isAr ? 'سناك' : 'Snacks'}: ×${exampleSn}`,
                  ].map((t, i) => (
                    <span key={i} style={{ background: 'white', padding: '3px 10px', borderRadius: '999px', border: '1px solid #e2e8f0' }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* تفاصيل الحساب */}
              {exPrice && (
                <div>
                  {[
                    { icon: '🍳', label: isAr ? 'الفطور' : 'Breakfast', val: exPrice.bf,    formula: `${pricing.breakfastPerGram} × ${exampleGrams} × ${exampleBf} × ${exampleDays}` },
                    { icon: '🍛', label: isAr ? 'الغداء' : 'Lunch',     val: exPrice.ln,    formula: `${pricing.lunchPerGram} × ${exampleGrams} × ${exampleLn} × ${exampleDays}` },
                    { icon: '🌙', label: isAr ? 'العشاء' : 'Dinner',    val: exPrice.dn,    formula: `${pricing.dinnerPerGram} × ${exampleGrams} × ${exampleDn} × ${exampleDays}` },
                    { icon: '🥗', label: isAr ? 'السناك' : 'Snacks',    val: exPrice.sn,    formula: `${pricing.snackPerDay} × ${exampleSn} × ${exampleDays}` },
                    { icon: '🚗', label: isAr ? 'مصاريف ثابتة' : 'Fixed Costs', val: exPrice.fixed, formula: `${pricing.fixedCostPerDay} × ${exampleDays}` },
                  ].map((row, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', borderRadius: '8px', marginBottom: '6px',
                      background: '#f8fafc', border: '1px solid #e2e8f0',
                    }}>
                      <div>
                        <span style={{ marginLeft: '6px' }}>{row.icon}</span>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{row.label}</span>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>{row.formula}</div>
                      </div>
                      <span style={{ fontWeight: 700, color: '#0d9488' }}>
                        {row.val.toFixed(3)} KWD
                      </span>
                    </div>
                  ))}

                  {/* الإجمالي */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 16px', borderRadius: '10px', marginTop: '12px',
                    background: '#0d9488', color: 'white',
                  }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                      {isAr ? 'إجمالي الاشتراك' : 'Total Subscription'}
                    </span>
                    <span style={{ fontWeight: 900, fontSize: '1.3rem' }}>
                      {exTotal.toFixed(3)} KWD
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── إعدادات الباقة المرنة ── */}
        <div className="card" style={{ marginTop: '28px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>⚙️ {isAr ? 'إعدادات الباقة المرنة' : 'Flex Package Settings'}</h3>
            <button className="btn btn-primary" onClick={handleSaveFlex} disabled={savingFlex}>
              {savingFlex ? (isAr ? 'جاري الحفظ...' : 'Saving...') : `💾 ${isAr ? 'حفظ الإعدادات' : 'Save Settings'}`}
            </button>
          </div>
          {msgFlex && <div style={{ margin: '0 24px' }}><div className="alert alert-success fade-in">{msgFlex}</div></div>}
          <div className="card-body">
            {/* Toggle إظهار في موقع العميل */}
            <div onClick={() => updateFlex('showOnWebsite', !flexSettings.showOnWebsite)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', borderRadius: '12px', marginBottom: '20px', cursor: 'pointer',
                border: `2px solid ${flexSettings.showOnWebsite ? '#0d9488' : '#e2e8f0'}`,
                background: flexSettings.showOnWebsite ? '#f0fdfa' : '#f8fafc',
                transition: 'all 0.2s',
              }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: flexSettings.showOnWebsite ? '#0d9488' : '#374151' }}>
                  🌐 {isAr ? 'إظهار الباقة المرنة في موقع العميل' : 'Show Flex Package on Client Website'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 3 }}>
                  {isAr ? 'عند التفعيل ستظهر كارد الباقة المرنة في صفحة الباقات' : 'When enabled, flex package card appears on the packages page'}
                </div>
              </div>
              <div style={{
                width: 48, height: 26, borderRadius: 999, position: 'relative', flexShrink: 0,
                background: flexSettings.showOnWebsite ? '#0d9488' : '#cbd5e1',
                transition: 'background 0.2s',
              }}>
                <div style={{
                  position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%', background: 'white',
                  transition: 'left 0.2s',
                  left: flexSettings.showOnWebsite ? 25 : 3,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              {[
                { key: 'minDaysPerWeek',  ar: 'أقل أيام في الأسبوع',  en: 'Min Days / Week',     min: 1,  max: 6   },
                { key: 'maxDaysPerWeek',  ar: 'أكثر أيام في الأسبوع', en: 'Max Days / Week',     min: 1,  max: 6   },
                { key: 'minMealsPerDay',  ar: 'أقل وجبات في اليوم',   en: 'Min Meals / Day',     min: 1,  max: 5   },
                { key: 'maxMealsPerDay',  ar: 'أكثر وجبات في اليوم',  en: 'Max Meals / Day',     min: 1,  max: 5   },
                { key: 'minSnacks',       ar: 'أقل سناك',             en: 'Min Snacks',           min: 0,  max: 3   },
                { key: 'maxSnacks',       ar: 'أكثر سناك',            en: 'Max Snacks',           min: 0,  max: 3   },
              ].map(item => (
                <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}>
                    {isAr ? item.ar : item.en}
                  </label>
                  <input
                    type="number"
                    min={item.min}
                    max={item.max}
                    value={flexSettings[item.key] ?? item.min}
                    onChange={e => updateFlex(item.key, Number(e.target.value))}
                    style={{
                      padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px',
                      fontFamily: 'var(--font-main)', fontSize: '0.95rem', fontWeight: 700,
                      textAlign: 'center', outline: 'none', width: '100%',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* أيام التجميد */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '8px', color: '#374151' }}>
                ❄️ {isAr ? 'أقصى أيام التجميد المسموحة' : 'Max Freeze Days Allowed'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={flexSettings.maxFreezeDays ?? 0}
                  onChange={e => updateFlex('maxFreezeDays', Number(e.target.value))}
                  style={{
                    width: '100px', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px',
                    fontFamily: 'var(--font-main)', fontSize: '0.95rem', fontWeight: 700,
                    textAlign: 'center', outline: 'none',
                  }}
                />
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{isAr ? 'يوم' : 'days'}</span>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  {isAr ? '(0 = التجميد غير مسموح)' : '(0 = freeze not allowed)'}
                </span>
              </div>
            </div>

            {/* Allowed Durations */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '10px', color: '#374151' }}>
                {isAr ? 'مدد الاشتراك المسموحة' : 'Allowed Durations'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {DURATION_OPTIONS.map(opt => (
                  <label key={opt.days} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none',
                    padding: '6px 14px', borderRadius: '8px', border: '1.5px solid',
                    borderColor: (flexSettings.allowedDurations || []).includes(opt.days) ? '#0d9488' : '#e2e8f0',
                    background: (flexSettings.allowedDurations || []).includes(opt.days) ? '#f0fdfa' : 'white',
                    transition: 'all 0.15s',
                  }}>
                    <input
                      type="checkbox"
                      checked={(flexSettings.allowedDurations || []).includes(opt.days)}
                      onChange={() => toggleFlexArray('allowedDurations', opt.days)}
                      style={{ accentColor: '#0d9488' }}
                    />
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{opt.label}</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({opt.days}d)</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Allowed Protein */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '10px', color: '#374151' }}>
                {isAr ? 'قيم البروتين المسموحة (جرام)' : 'Allowed Protein Values (g)'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {[80, 90, 100, 120, 150, 180, 200].map(val => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={(flexSettings.allowedProtein || []).includes(val)}
                      onChange={() => toggleFlexArray('allowedProtein', val)}
                    />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{val}g</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Allowed Carbs */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '10px', color: '#374151' }}>
                {isAr ? 'قيم الكارب المسموحة (جرام)' : 'Allowed Carbs Values (g)'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {[50, 80, 100, 120, 150, 200].map(val => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={(flexSettings.allowedCarbs || []).includes(val)}
                      onChange={() => toggleFlexArray('allowedCarbs', val)}
                    />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{val}g</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
