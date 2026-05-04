import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useLang } from '../LanguageContext';

const DEFAULT_CONFIG = {
  enabled: false,
  couponCode: '',
  titleAr: '🎁 عرض خاص ليك!',
  titleEn: '🎁 Special Offer!',
  messageAr: 'استخدم الكود ده ووفّر على باقتك',
  messageEn: 'Use this code and save on your package',
  countdownMinutes: 3,        // مدة العداد بالدقائق
  delaySeconds: 3,            // التأخير قبل ظهور البوب أب
  showFrequency: 'once_per_session', // once_per_session | once_per_day | always
  oncePerPhone: true,         // مرة واحدة لكل رقم تليفون
};

export default function PopupCouponConfig() {
  const { isAr } = useLang();
  const [form, setForm]       = useState(DEFAULT_CONFIG);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState('');
  const [msgType, setMsgType] = useState('success');
  const [stats, setStats]     = useState({ totalShown: 0, totalUsed: 0, totalClaims: 0 });

  const showMsg = (m, t='success') => {
    setMsg(m); setMsgType(t);
    setTimeout(() => setMsg(''), 3500);
  };

  // تحميل الإعدادات + قائمة الكوبونات + إحصائيات
  useEffect(() => {
    (async () => {
      try {
        const [cfgSnap, couponsSnap, claimsSnap] = await Promise.all([
          getDoc(doc(db, 'appConfig', 'popupCoupon')),
          getDocs(collection(db, 'coupons')),
          getDocs(collection(db, 'popupCouponClaims')).catch(() => ({ docs: [] })),
        ]);

        if (cfgSnap.exists()) {
          setForm({ ...DEFAULT_CONFIG, ...cfgSnap.data() });
        }

        const allCoupons = couponsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCoupons(allCoupons);

        const claims = claimsSnap.docs?.map(d => d.data()) || [];
        setStats({
          totalShown:  claims.length,
          totalUsed:   claims.filter(c => c.status === 'used').length,
          totalClaims: claims.filter(c => c.status === 'claimed').length,
        });
      } catch (err) {
        console.error(err);
        showMsg('❌ ' + (err.message || 'خطأ في التحميل'), 'error');
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (form.enabled && !form.couponCode) {
      showMsg(isAr ? '❌ اختر كود الخصم' : '❌ Select a coupon code', 'error');
      return;
    }
    if (form.enabled && !form.titleAr && !form.titleEn) {
      showMsg(isAr ? '❌ ضع عنوان للبوب أب' : '❌ Enter a popup title', 'error');
      return;
    }

    setSaving(true);
    try {
      const data = {
        ...form,
        couponCode: form.couponCode.toUpperCase().trim(),
        countdownSeconds: Number(form.countdownMinutes) * 60, // المتوقع في الموقع بالثواني
        countdownMinutes: Number(form.countdownMinutes),
        delaySeconds:    Number(form.delaySeconds),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'appConfig', 'popupCoupon'), data, { merge: true });
      showMsg(isAr ? '✅ تم الحفظ بنجاح' : '✅ Saved successfully');
    } catch (err) {
      showMsg('❌ ' + err.message, 'error');
    }
    setSaving(false);
  };

  const activeCoupons = coupons.filter(c => c.isActive !== false);
  const selectedCoupon = coupons.find(c => c.code === form.couponCode);

  if (loading) {
    return (
      <div>
        <div className="page-header"><h2>🎯 {isAr ? 'بوب-أب الكوبون' : 'Coupon Popup'}</h2></div>
        <div className="page-body">
          <div className="loading"><div className="spinner" /></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🎯 {isAr ? 'بوب-أب الكوبون' : 'Coupon Popup'}</h2>
          <div className="breadcrumb">
            {isAr ? 'إعدادات البوب أب الترويجي على الموقع' : 'Promotional popup settings on the website'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{
            padding: '6px 14px',
            borderRadius: 999,
            fontSize: '0.82rem',
            fontWeight: 700,
            background: form.enabled ? '#dcfce7' : '#f1f5f9',
            color:      form.enabled ? '#16a34a' : '#64748b',
            border:     `1px solid ${form.enabled ? '#86efac' : '#cbd5e1'}`,
          }}>
            {form.enabled ? (isAr ? '🟢 شغّال' : '🟢 Active') : (isAr ? '⚪ مقفل' : '⚪ Off')}
          </span>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className={`alert ${msgType === 'error' ? 'alert-error' : 'alert-success'} fade-in`}>{msg}</div>}

        {/* الإحصائيات */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { label: isAr ? 'إجمالي الاستلام' : 'Total Claims',     value: stats.totalShown,  color: '#7c3aed', bg: '#ede9fe', icon: '👁' },
            { label: isAr ? 'استخدموا الكود'  : 'Used the Code',    value: stats.totalUsed,   color: '#16a34a', bg: '#dcfce7', icon: '✅' },
            { label: isAr ? 'لم يستخدمه بعد'  : 'Not Yet Used',     value: stats.totalClaims, color: '#d97706', bg: '#fff7ed', icon: '⏳' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background: s.bg }}>
                <span style={{ color: s.color, fontSize: '1.3rem' }}>{s.icon}</span>
              </div>
              <div className="stat-info">
                <h3 style={{ color: s.color }}>{s.value}</h3>
                <p>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-body">
            <div className="form-grid">

              {/* تفعيل/إيقاف */}
              <div className="form-group full-width">
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '14px 18px',
                  background: form.enabled ? '#f0fdfa' : '#f8fafc', borderRadius: 10,
                  border: `1px solid ${form.enabled ? '#0d9488' : '#e2e8f0'}` }}>
                  <input type="checkbox" checked={form.enabled}
                    onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))}
                    style={{ accentColor: '#0d9488', width: 18, height: 18 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: form.enabled ? '#0d9488' : '#475569' }}>
                      {isAr ? 'تفعيل البوب أب على الموقع' : 'Enable popup on website'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>
                      {isAr ? 'لما يكون مفعّل، البوب أب هيظهر للزوار حسب الإعدادات تحت' : 'When enabled, the popup will show to visitors based on settings below'}
                    </div>
                  </div>
                </label>
              </div>

              {/* اختيار الكوبون */}
              <div className="form-group full-width">
                <label className="form-label">🎟 {isAr ? 'كود الخصم' : 'Coupon Code'} *</label>
                {activeCoupons.length === 0 ? (
                  <div style={{ padding: 14, background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa', color: '#c2410c', fontSize: '0.85rem' }}>
                    ⚠️ {isAr ? 'لا يوجد كوبونات نشطة. أنشئ كوبون أولاً من صفحة الكوبونات.' : 'No active coupons. Create a coupon first from the Coupons page.'}
                  </div>
                ) : (
                  <select className="form-control" value={form.couponCode}
                    onChange={e => setForm(p => ({ ...p, couponCode: e.target.value }))}
                    style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                    <option value="">— {isAr ? 'اختر كوبون' : 'Select coupon'} —</option>
                    {activeCoupons.map(c => (
                      <option key={c.id} value={c.code}>
                        {c.code} — {c.discountType === 'percentage' ? `${c.discountValue}%` : `${c.discountValue} KWD`}
                        {c.nameAr ? ` (${c.nameAr})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {selectedCoupon && (
                  <div style={{ marginTop: 8, padding: 10, background: '#f0fdfa', borderRadius: 8, fontSize: '0.82rem', color: '#0d9488', fontWeight: 600 }}>
                    ✅ {isAr ? 'الخصم' : 'Discount'}: {selectedCoupon.discountType === 'percentage' ? `${selectedCoupon.discountValue}%` : `${selectedCoupon.discountValue} KWD`}
                    {selectedCoupon.expiryDate && <span> — {isAr ? 'ينتهي' : 'Expires'}: {selectedCoupon.expiryDate}</span>}
                  </div>
                )}
              </div>

              {/* العنوان */}
              <div className="form-group">
                <label className="form-label">📝 {isAr ? 'العنوان (عربي)' : 'Title (Arabic)'}</label>
                <input className="form-control" value={form.titleAr}
                  onChange={e => setForm(p => ({ ...p, titleAr: e.target.value }))}
                  placeholder="🎁 عرض خاص ليك!" />
              </div>
              <div className="form-group">
                <label className="form-label">📝 {isAr ? 'العنوان (إنجليزي)' : 'Title (English)'}</label>
                <input className="form-control" value={form.titleEn}
                  onChange={e => setForm(p => ({ ...p, titleEn: e.target.value }))}
                  placeholder="🎁 Special Offer!" />
              </div>

              {/* الرسالة */}
              <div className="form-group">
                <label className="form-label">💬 {isAr ? 'الرسالة (عربي)' : 'Message (Arabic)'}</label>
                <textarea className="form-control" value={form.messageAr} rows={2}
                  onChange={e => setForm(p => ({ ...p, messageAr: e.target.value }))}
                  placeholder="استخدم الكود ووفّر على باقتك" />
              </div>
              <div className="form-group">
                <label className="form-label">💬 {isAr ? 'الرسالة (إنجليزي)' : 'Message (English)'}</label>
                <textarea className="form-control" value={form.messageEn} rows={2}
                  onChange={e => setForm(p => ({ ...p, messageEn: e.target.value }))}
                  placeholder="Use the code and save" />
              </div>

              {/* المؤقت + التأخير */}
              <div className="form-group">
                <label className="form-label">⏱ {isAr ? 'مدة العداد (دقائق)' : 'Countdown (minutes)'}</label>
                <input className="form-control" type="number" min="1" max="60"
                  value={form.countdownMinutes}
                  onChange={e => setForm(p => ({ ...p, countdownMinutes: e.target.value }))} />
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>
                  {isAr ? 'لما العداد يخلص، الكود يختفي من المتصفح' : 'When timer ends, code expires in the browser'}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">⏰ {isAr ? 'يظهر بعد (ثواني)' : 'Show after (seconds)'}</label>
                <input className="form-control" type="number" min="0" max="60"
                  value={form.delaySeconds}
                  onChange={e => setForm(p => ({ ...p, delaySeconds: e.target.value }))} />
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>
                  {isAr ? 'وقت التأخير من فتح الموقع لظهور البوب أب' : 'Delay from page load to popup appearance'}
                </div>
              </div>

              {/* التكرار */}
              <div className="form-group full-width">
                <label className="form-label">🔁 {isAr ? 'كم مرة يظهر للعميل' : 'Display Frequency'}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {[
                    { value: 'once_per_session', ar: 'مرة كل جلسة',  en: 'Once per session', desc: isAr ? 'يظهر مرة لما يفتح الموقع، ولو قفل وفتح تاني هيظهر تاني' : 'Shows once per visit; reappears on next session' },
                    { value: 'once_per_day',     ar: 'مرة كل يوم',   en: 'Once per day',     desc: isAr ? 'يظهر مرة في اليوم فقط لنفس الجهاز'                  : 'Shows once a day per device' },
                    { value: 'always',           ar: 'كل مرة',       en: 'Always',           desc: isAr ? 'يظهر كل ما يفتح صفحة'                                : 'Shows every page load' },
                  ].map(opt => (
                    <label key={opt.value} style={{
                      flex: '1 1 200px', cursor: 'pointer', padding: 14, borderRadius: 10,
                      background: form.showFrequency === opt.value ? '#f0fdfa' : '#f8fafc',
                      border:     `2px solid ${form.showFrequency === opt.value ? '#0d9488' : '#e2e8f0'}`,
                      transition: 'all 0.15s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <input type="radio" name="showFrequency"
                          checked={form.showFrequency === opt.value}
                          onChange={() => setForm(p => ({ ...p, showFrequency: opt.value }))}
                          style={{ accentColor: '#0d9488' }} />
                        <span style={{ fontWeight: 700, fontSize: '0.88rem',
                          color: form.showFrequency === opt.value ? '#0d9488' : '#475569' }}>
                          {isAr ? opt.ar : opt.en}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.4 }}>{opt.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              {/* مرة لكل تليفون */}
              <div className="form-group full-width">
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                  padding: 14, background: form.oncePerPhone ? '#fff7ed' : '#f8fafc', borderRadius: 10,
                  border: `1px solid ${form.oncePerPhone ? '#fb923c' : '#e2e8f0'}` }}>
                  <input type="checkbox" checked={form.oncePerPhone}
                    onChange={e => setForm(p => ({ ...p, oncePerPhone: e.target.checked }))}
                    style={{ accentColor: '#ea580c', width: 18, height: 18, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: form.oncePerPhone ? '#c2410c' : '#475569' }}>
                      🔒 {isAr ? 'مرة واحدة لكل رقم تليفون' : 'One use per phone number'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 4, lineHeight: 1.5 }}>
                      {isAr
                        ? 'كل عميل بنفس رقم التليفون يقدر يستخدم الكود مرة واحدة فقط. لو حاول يستخدمه تاني، النظام هيرفض.'
                        : 'Each client (by phone number) can use the code once only. Subsequent attempts will be rejected.'}
                    </div>
                  </div>
                </label>
              </div>

              {/* زر الحفظ */}
              <div className="form-group full-width" style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn btn-primary" onClick={save} disabled={saving}
                  style={{ flex: 1 }}>
                  {saving
                    ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> {isAr ? 'جاري الحفظ...' : 'Saving...'}</>
                    : `✅ ${isAr ? 'حفظ الإعدادات' : 'Save Settings'}`}
                </button>
              </div>

              {/* معاينة */}
              {form.enabled && form.couponCode && (
                <div className="form-group full-width">
                  <div style={{ marginTop: 14, padding: 18, background: 'linear-gradient(160deg, #1a2942, #0f1a2e)',
                    borderRadius: 16, border: '1px solid rgba(13,148,136,0.4)', textAlign: 'center', color: '#fff' }}>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 12, fontWeight: 700 }}>
                      👀 {isAr ? 'معاينة شكل البوب أب' : 'Popup Preview'}
                    </div>
                    <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>🎉</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: 6 }}>
                      {isAr ? form.titleAr : form.titleEn}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>
                      {isAr ? form.messageAr : form.messageEn}
                    </div>
                    <div style={{ display: 'inline-block', padding: '10px 18px',
                      background: 'rgba(13,148,136,0.15)', border: '2px dashed #0d9488',
                      borderRadius: 10, fontFamily: 'monospace', fontWeight: 900, fontSize: '1.1rem',
                      color: '#5eead4', letterSpacing: 2 }}>
                      {form.couponCode || 'CODE'}
                    </div>
                    <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#fb923c', fontWeight: 700 }}>
                      ⏰ {String(form.countdownMinutes).padStart(2, '0')}:00
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
