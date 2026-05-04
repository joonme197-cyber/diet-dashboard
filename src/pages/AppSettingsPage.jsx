import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useLang } from '../LanguageContext';

const MEAL_KEYS = [
  { key: 'افطار', icon: '🌅', defaultAr: 'الفطور',  defaultEn: 'Breakfast' },
  { key: 'غداء',  icon: '☀️', defaultAr: 'الغداء',  defaultEn: 'Lunch'     },
  { key: 'عشاء',  icon: '🌙', defaultAr: 'العشاء',  defaultEn: 'Dinner'    },
  { key: 'سناك',  icon: '🥗', defaultAr: 'السناك',  defaultEn: 'Snacks'    },
];

export default function AppSettingsPage() {
  const { isAr } = useLang();
  const [labels, setLabels]   = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState({ text: '', type: '' });

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'appConfig', 'mealTypeLabels'));
        if (snap.exists()) {
          setLabels(snap.data());
        } else {
          // Set defaults
          const defaults = {};
          MEAL_KEYS.forEach(m => { defaults[m.key] = { ar: m.defaultAr, en: m.defaultEn }; });
          setLabels(defaults);
        }
      } catch (e) {
        console.error(e);
        const defaults = {};
        MEAL_KEYS.forEach(m => { defaults[m.key] = { ar: m.defaultAr, en: m.defaultEn }; });
        setLabels(defaults);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateLabel = (key, lang, value) => {
    setLabels(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [lang]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'appConfig', 'mealTypeLabels'), {
        ...labels,
        updatedAt: serverTimestamp(),
      });
      showMsg(isAr ? '✅ تم حفظ التسميات بنجاح' : '✅ Labels saved successfully');
    } catch (e) {
      console.error(e);
      showMsg(isAr ? '❌ خطأ في الحفظ' : '❌ Save failed', 'error');
    }
    setSaving(false);
  };

  const cardStyle = {
    background: 'var(--bg-card, #fff)',
    border: '1px solid var(--border, #e2e8f0)',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  };
  const labelStyle = {
    display: 'block',
    fontWeight: 700,
    fontSize: '0.82rem',
    color: 'var(--text-muted, #64748b)',
    marginBottom: 6,
  };
  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid var(--border, #e2e8f0)',
    background: 'var(--bg-secondary, #f8fafc)',
    color: 'var(--text-primary, #1e293b)',
    fontFamily: 'var(--font-main, Cairo, sans-serif)',
    fontSize: '0.9rem',
    boxSizing: 'border-box',
    outline: 'none',
  };

  return (
    <div dir={isAr ? 'rtl' : 'ltr'}>
      <div className="page-header">
        <h2>⚙️ {isAr ? 'إعدادات التطبيق' : 'App Settings'}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>
          {isAr
            ? 'تخصيص تسميات أنواع الوجبات بالعربية والإنجليزية'
            : 'Customize meal type labels in Arabic and English'}
        </p>
      </div>

      <div className="page-body">
        {msg.text && (
          <div className={`alert ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 20 }}>
            {msg.text}
          </div>
        )}

        <div style={cardStyle}>
          <h3 style={{ marginBottom: 20, fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
            🍽 {isAr ? 'تسميات أنواع الوجبات' : 'Meal Type Labels'}
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            {isAr
              ? '⚠️ ملاحظة: المفتاح (Key) لا يتغير — فقط النص المعروض للعميل يتغير. تأكد من إدخال الترجمة الصحيحة.'
              : '⚠️ Note: The key never changes — only the display text shown to clients is updated. Make sure to enter correct translations.'}
          </p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="spinner" />
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 20 }}>
              {MEAL_KEYS.map(m => (
                <div key={m.key} style={{
                  background: 'var(--bg-secondary, #f8fafc)',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: 10,
                  padding: '16px 20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: '1.4rem' }}>{m.icon}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                        {isAr ? m.defaultAr : m.defaultEn}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                        key: <strong>{m.key}</strong>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>🇸🇦 {isAr ? 'الاسم بالعربية' : 'Arabic Name'}</label>
                      <input
                        style={inputStyle}
                        dir="rtl"
                        value={labels[m.key]?.ar ?? m.defaultAr}
                        onChange={e => updateLabel(m.key, 'ar', e.target.value)}
                        placeholder={m.defaultAr}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>🇬🇧 {isAr ? 'الاسم بالإنجليزية' : 'English Name'}</label>
                      <input
                        style={inputStyle}
                        dir="ltr"
                        value={labels[m.key]?.en ?? m.defaultEn}
                        onChange={e => updateLabel(m.key, 'en', e.target.value)}
                        placeholder={m.defaultEn}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && (
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ minWidth: 140 }}
              >
                {saving ? (isAr ? '⏳ جاري الحفظ...' : '⏳ Saving...') : (isAr ? '💾 حفظ التغييرات' : '💾 Save Changes')}
              </button>
            </div>
          )}
        </div>

        {/* Preview */}
        {!loading && (
          <div style={cardStyle}>
            <h3 style={{ marginBottom: 16, fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
              👁 {isAr ? 'معاينة' : 'Preview'}
            </h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {MEAL_KEYS.map(m => (
                <div key={m.key} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '12px 20px', borderRadius: 10,
                  background: 'var(--bg-secondary, #f8fafc)',
                  border: '1px solid var(--border, #e2e8f0)',
                  minWidth: 100,
                }}>
                  <span style={{ fontSize: '1.5rem' }}>{m.icon}</span>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{labels[m.key]?.ar ?? m.defaultAr}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{labels[m.key]?.en ?? m.defaultEn}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
