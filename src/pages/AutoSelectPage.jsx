import { useState, useEffect } from 'react';
import {
  getAutoSelectSettings, saveAutoSelectSettings,
  runAutoSelect, getAutoSelectLog, checkAndRunScheduled,
} from '../firebase/autoSelectService';
import { useLang } from '../LanguageContext';
import { db } from '../firebase/config';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { getAllSubscriptions, getSubscriptionStatus } from '../firebase/subscriptionService';
import { saveClientDailyMeals } from '../firebase/mealService';
import { getPackages } from '../firebase/packageService';

export default function AutoSelectPage() {
  const { isAr } = useLang();

  const [settings, setSettings]   = useState(null);
  const [log, setLog]             = useState([]);
  const [loading, setLoading]     = useState(true);
  const [running, setRunning]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState({ text: '', type: '' });
  const [lastResult, setLastResult] = useState(null);

  // ── تجميد/إلغاء جماعي ──
  const [bulkTab, setBulkTab]         = useState('freeze'); // freeze | delete
  const [bulkDate, setBulkDate]       = useState('');
  const [bulkDateTo, setBulkDateTo]   = useState('');
  const [bulkMode, setBulkMode]       = useState('single'); // single | range
  const [bulkRunning, setBulkRunning]     = useState(false);
  const [bulkResult, setBulkResult]       = useState(null);
  const [logOpen, setLogOpen]               = useState(false);
  const [migrateRunning, setMigrateRunning] = useState(false);
  const [migrateResult, setMigrateResult]   = useState(null);

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  const load = async () => {
    setLoading(true);
    const [s, l] = await Promise.all([getAutoSelectSettings(), getAutoSelectLog()]);
    setSettings(s);
    setLog(l.runs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    await saveAutoSelectSettings(settings);
    setSaving(false);
    showMsg(isAr ? '✅ تم حفظ الإعدادات' : '✅ Settings saved');
  };

  const handleRunNow = async () => {
    setRunning(true);
    showMsg(isAr ? '⏳ جاري التشغيل...' : '⏳ Running...', 'info');
    try {
      const result = await runAutoSelect(true);
      setLastResult(result);
      showMsg(
        isAr
          ? `✅ اكتمل! تم اختيار وجبات لـ ${result.processed} عميل`
          : `✅ Done! Auto-selected for ${result.processed} clients`
      );
      load();
    } catch (e) {
      showMsg(isAr ? '❌ حدث خطأ' : '❌ Error occurred', 'error');
    }
    setRunning(false);
  };

  // ── دالة التجميد الجماعي ──
  const handleBulkFreeze = async () => {
    if (!bulkDate) return;
    if (!window.confirm(isAr
      ? `تجميد يوم ${bulkDate} لكل المشتركين النشطين؟ سيتم تمديد اشتراكاتهم يوماً تلقائياً`
      : `Freeze ${bulkDate} for all active subscribers?`)) return;

    setBulkRunning(true); setBulkResult(null);
    try {
      const allSubs = await getAllSubscriptions();
      const activeSubs = allSubs.filter(s => getSubscriptionStatus(s) === 'active');

      // توليد قائمة التواريخ (يوم واحد أو نطاق)
      const dates = [];
      if (bulkMode === 'single') {
        dates.push(bulkDate);
      } else {
        const from = new Date(bulkDate);
        const to   = new Date(bulkDateTo || bulkDate);
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().split('T')[0]);
        }
      }

      let count = 0;
      for (const sub of activeSubs) {
        const frozenDays = sub.frozenDays || [];
        const newDays = dates.filter(d => !frozenDays.includes(d));
        if (newDays.length === 0) continue;
        // تمديد الاشتراك
        const endDate = new Date(sub.endDate);
        endDate.setDate(endDate.getDate() + newDays.length);
        await updateDoc(doc(db, 'subscriptions', sub.id), {
          frozenDays: [...frozenDays, ...newDays],
          endDate: endDate.toISOString().split('T')[0],
          bonusDays: (sub.bonusDays || 0) + newDays.length,
        });
        count++;
      }

      setBulkResult({ count, dates });
      showMsg(isAr
        ? `✅ تم تجميد ${dates.length} يوم لـ ${count} مشترك وتمديد اشتراكاتهم`
        : `✅ Frozen ${dates.length} day(s) for ${count} subscribers`);
    } catch (e) {
      showMsg(isAr ? '❌ حدث خطأ' : '❌ Error', 'error');
    }
    setBulkRunning(false);
  };

  // ── دالة حذف اختيارات يوم ──
  const handleBulkDeleteMeals = async () => {
    if (!bulkDate) return;
    if (!window.confirm(isAr
      ? `حذف اختيارات وجبات ${bulkDate === bulkDateTo || bulkMode === 'single' ? bulkDate : `من ${bulkDate} إلى ${bulkDateTo}`} لكل المشتركين؟`
      : `Delete meals for selected dates?`)) return;

    setBulkRunning(true); setBulkResult(null);
    try {
      const dates = [];
      if (bulkMode === 'single') {
        dates.push(bulkDate);
      } else {
        const from = new Date(bulkDate);
        const to   = new Date(bulkDateTo || bulkDate);
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().split('T')[0]);
        }
      }

      const snap = await getDocs(collection(db, 'clientDailyMeals'));
      let count = 0;
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        if (dates.includes(data.date)) {
          await updateDoc(doc(db, 'clientDailyMeals', docSnap.id), {
            meals: { افطار: [], غداء: [], عشاء: [], سناك: [] }
          });
          count++;
        }
      }

      setBulkResult({ count, dates });
      showMsg(isAr
        ? `✅ تم حذف اختيارات ${count} عميل ليوم ${dates.join('، ')}`
        : `✅ Cleared meals for ${count} clients`);
    } catch (e) {
      showMsg(isAr ? '❌ حدث خطأ' : '❌ Error', 'error');
    }
    setBulkRunning(false);
  };

  // ── ترحيل الاشتراكات القديمة: تعبئة deliveryDays من إعدادات الباقة ──
  const handleMigrateDeliveryDays = async (previewOnly = false) => {
    setMigrateRunning(true); setMigrateResult(null);
    try {
      const [allSubs, allPackages] = await Promise.all([getAllSubscriptions(), getPackages()]);
      const pkgMap = {};
      for (const p of allPackages) pkgMap[p.id] = p;

      const toMigrate = allSubs.filter(s => !s.deliveryDays || s.deliveryDays.length === 0);

      if (previewOnly) {
        setMigrateResult({ preview: true, count: toMigrate.length, subs: toMigrate.slice(0, 10) });
        setMigrateRunning(false);
        return;
      }

      let updated = 0;
      for (const sub of toMigrate) {
        const pkg = pkgMap[sub.packageId];
        const deliveryDays = pkg?.fridays === true
          ? [0, 1, 2, 3, 4, 5, 6]  // 7 أيام شاملة الجمعة
          : [0, 1, 2, 3, 4, 5];    // 6 أيام بدون الجمعة (الافتراضي)
        await updateDoc(doc(db, 'subscriptions', sub.id), { deliveryDays });
        updated++;
      }

      setMigrateResult({ preview: false, count: updated });
      showMsg(isAr ? `✅ تم تحديث ${updated} اشتراك` : `✅ Updated ${updated} subscriptions`);
    } catch (e) {
      showMsg(isAr ? '❌ حدث خطأ' : '❌ Error', 'error');
    }
    setMigrateRunning(false);
  };

  const fmtDate = (iso) => {
    if (!iso) return '---';
    return new Date(iso).toLocaleString(isAr ? 'ar-KW' : 'en-GB');
  };

  const fmtDateShort = (dateStr) => {
    if (!dateStr) return '---';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  if (loading) return <div className="loading"><div className="spinner" />{isAr ? 'جاري التحميل...' : 'Loading...'}</div>;

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h2>🤖 {isAr ? 'الاختيار التلقائي للوجبات' : 'Auto-Select Meals'}</h2>
          <div className="breadcrumb">
            {isAr ? 'اختيار وجبات العملاء تلقائياً من منيو الشيف' : 'Auto-select client meals from chef menu'}
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleRunNow}
          disabled={running}
          style={{ minWidth: '160px' }}
        >
          {running
            ? <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />&nbsp;{isAr ? 'جاري التشغيل...' : 'Running...'}</>
            : `⚡ ${isAr ? 'تشغيل فوري الآن' : 'Run Now'}`}
        </button>
      </div>

      {msg.text && (
        <div style={{ margin: '0 32px' }}>
          <div className={`alert ${msg.type === 'error' ? 'alert-error' : 'alert-success'} fade-in`}>
            {msg.text}
          </div>
        </div>
      )}

      <div className="page-body">

        {/* ── Stats ── */}
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          {[
            {
              icon: '🕐',
              val: settings?.lastRun ? fmtDate(settings.lastRun) : (isAr ? 'لم يشتغل بعد' : 'Never run'),
              label: isAr ? 'آخر تشغيل' : 'Last Run',
              cls: 'teal',
              small: true,
            },
            {
              icon: '👥',
              val: settings?.lastRunCount ?? 0,
              label: isAr ? 'آخر عملية: عملاء' : 'Last Run: Clients',
              cls: 'blue',
            },
            {
              icon: '⏳',
              val: `${settings?.offsetHours ?? 48}h`,
              label: isAr ? 'قبل التوصيل بـ' : 'Before Delivery',
              cls: 'orange',
            },
            {
              icon: settings?.enabled ? '✅' : '⏸️',
              val: settings?.enabled ? (isAr ? 'مفعّل' : 'Enabled') : (isAr ? 'موقوف' : 'Disabled'),
              label: isAr ? 'الحالة' : 'Status',
              cls: settings?.enabled ? 'teal' : 'purple',
            },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className={`stat-icon ${s.cls}`}>{s.icon}</div>
              <div className="stat-info">
                <h3 style={{ fontSize: s.small ? '0.9rem' : undefined }}>{s.val}</h3>
                <p>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

          {/* ── الإعدادات ── */}
          <div className="card">
            <div className="card-header">
              <h3>⚙️ {isAr ? 'إعدادات التشغيل التلقائي' : 'Auto-Run Settings'}</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox"
                  checked={settings?.enabled ?? true}
                  onChange={e => setSettings(p => ({ ...p, enabled: e.target.checked }))}
                  style={{ accentColor: '#0d9488', width: '18px', height: '18px' }}
                />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: settings?.enabled ? '#0d9488' : '#94a3b8' }}>
                  {settings?.enabled ? (isAr ? 'مفعّل' : 'Enabled') : (isAr ? 'موقوف' : 'Disabled')}
                </span>
              </label>
            </div>
            <div className="card-body">

              {/* وقت التشغيل */}
              <div className="section-title">{isAr ? '🕐 وقت التشغيل اليومي' : '🕐 Daily Run Time'}</div>
              <div className="form-grid" style={{ marginBottom: '20px' }}>
                <div className="form-group">
                  <label className="form-label">{isAr ? 'الساعة (0-23)' : 'Hour (0-23)'}</label>
                  <div className="number-input">
                    <button type="button" onClick={() => setSettings(p => ({ ...p, runHour: Math.max(0, (p.runHour ?? 0) - 1) }))}>-</button>
                    <input type="number" value={settings?.runHour ?? 0} readOnly />
                    <button type="button" onClick={() => setSettings(p => ({ ...p, runHour: Math.min(23, (p.runHour ?? 0) + 1) }))}>+</button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{isAr ? 'الدقيقة (0-59)' : 'Minute (0-59)'}</label>
                  <div className="number-input">
                    <button type="button" onClick={() => setSettings(p => ({ ...p, runMinute: Math.max(0, (p.runMinute ?? 0) - 1) }))}>-</button>
                    <input type="number" value={settings?.runMinute ?? 0} readOnly />
                    <button type="button" onClick={() => setSettings(p => ({ ...p, runMinute: Math.min(59, (p.runMinute ?? 0) + 1) }))}>+</button>
                  </div>
                </div>
              </div>

              {/* الـ offset */}
              <div className="section-title">{isAr ? '⏳ وقت التحضير قبل التوصيل' : '⏳ Preparation Time Before Delivery'}</div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">
                  {isAr ? 'يختار الوجبات قبل يوم التوصيل بـ' : 'Select meals before delivery by'}
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {[24, 48, 72, 96].map(h => (
                    <button
                      key={h}
                      onClick={() => setSettings(p => ({ ...p, offsetHours: h }))}
                      style={{
                        padding: '8px 20px', borderRadius: '8px', border: 'none',
                        cursor: 'pointer', fontFamily: 'var(--font-main)',
                        fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s',
                        background: settings?.offsetHours === h ? '#0d9488' : '#f1f5f9',
                        color: settings?.offsetHours === h ? 'white' : '#64748b',
                        boxShadow: settings?.offsetHours === h ? '0 2px 8px rgba(13,148,136,0.3)' : 'none',
                      }}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#94a3b8' }}>
                  {isAr
                    ? `الآن: سيختار وجبات يوم ${new Date(Date.now() + (settings?.offsetHours || 48) * 3600000).toLocaleDateString('ar-KW')}`
                    : `Now: will select meals for ${new Date(Date.now() + (settings?.offsetHours || 48) * 3600000).toLocaleDateString('en-GB')}`
                  }
                </div>
              </div>

              {/* مدة فتح الاختيار للعميل */}
              <div className="section-title">{isAr ? '📱 مدة فتح الاختيار للعميل' : '📱 Client Order Window'}</div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">
                  {isAr ? 'يُسمح للعميل باختيار وجباته قبل يوم التوصيل بـ' : 'Allow client to choose meals before delivery by'}
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {[24, 48, 72, 96, 120].map(h => (
                    <button key={h}
                      onClick={() => setSettings(p => ({ ...p, orderLeadHours: h }))}
                      style={{
                        padding: '8px 20px', borderRadius: '8px', border: 'none',
                        cursor: 'pointer', fontFamily: 'var(--font-main)',
                        fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s',
                        background: (settings?.orderLeadHours ?? 72) === h ? '#7c3aed' : '#f1f5f9',
                        color: (settings?.orderLeadHours ?? 72) === h ? 'white' : '#64748b',
                        boxShadow: (settings?.orderLeadHours ?? 72) === h ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
                      }}>
                      {h}h
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#94a3b8' }}>
                  {isAr
                    ? `العميل يقدر يختار وجبات اليوم ${new Date(Date.now() + (settings?.orderLeadHours ?? 72) * 3600000).toLocaleDateString('ar-KW')} فأكثر`
                    : `Client can choose meals for ${new Date(Date.now() + (settings?.orderLeadHours ?? 72) * 3600000).toLocaleDateString('en-GB')} and beyond`
                  }
                </div>
                <div style={{ marginTop:'6px', padding:'8px 12px', background:'#faf5ff', borderRadius:'8px', fontSize:'0.78rem', color:'#7c3aed', border:'1px solid #ede9fe' }}>
                  ⚠️ {isAr
                    ? `لو العميل ماخترش قبل الـ ${settings?.offsetHours || 48}h — الكرون يختارله تلقائياً`
                    : `If client doesn't choose before ${settings?.offsetHours || 48}h — auto-select runs`
                  }
                </div>
              </div>

              {/* حد أدنى لبداية الاشتراك */}
              <div className="section-title">{isAr ? '📅 حد أدنى لبداية الاشتراك' : '📅 Min Subscription Start'}</div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">
                  {isAr ? 'أقل وقت بين تسجيل الاشتراك وأول توصيل (ساعة)' : 'Min hours between registration and first delivery'}
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {[24, 48, 72, 96].map(h => (
                    <button key={h}
                      onClick={() => setSettings(p => ({ ...p, subscriptionLeadHours: h }))}
                      style={{
                        padding: '8px 20px', borderRadius: '8px', border: 'none',
                        cursor: 'pointer', fontFamily: 'var(--font-main)',
                        fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s',
                        background: (settings?.subscriptionLeadHours ?? 72) === h ? '#0d9488' : '#f1f5f9',
                        color: (settings?.subscriptionLeadHours ?? 72) === h ? 'white' : '#64748b',
                        boxShadow: (settings?.subscriptionLeadHours ?? 72) === h ? '0 2px 8px rgba(13,148,136,0.3)' : 'none',
                      }}>
                      {h}h
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#94a3b8' }}>
                  {isAr
                    ? `أقرب تاريخ بداية اشتراك = اليوم + ${settings?.subscriptionLeadHours ?? 72}h = ${new Date(Date.now() + (settings?.subscriptionLeadHours ?? 72) * 3600000).toLocaleDateString('ar-KW')}`
                    : `Earliest start = today + ${settings?.subscriptionLeadHours ?? 72}h = ${new Date(Date.now() + (settings?.subscriptionLeadHours ?? 72) * 3600000).toLocaleDateString('en-GB')}`
                  }
                </div>
              </div>

              {/* ملاحظة */}
              <div style={{
                background: '#f0fdfa', border: '1px solid #ccfbf1',
                borderRadius: '8px', padding: '12px 14px',
                fontSize: '0.8rem', color: '#0f766e', marginBottom: '20px',
                lineHeight: 1.6,
              }}>
                <strong>ℹ️ {isAr ? 'كيف يعمل؟' : 'How it works?'}</strong><br />
                {isAr
                  ? `لما أي أدمن يفتح الداشبورد بعد الساعة ${settings?.runHour ?? 0}:${String(settings?.runMinute ?? 0).padStart(2,'0')}، بيتحقق تلقائياً ولو مش اتشغل النهارده بيشغّل الـ auto-select.`
                  : `When any admin opens the dashboard after ${settings?.runHour ?? 0}:${String(settings?.runMinute ?? 0).padStart(2,'0')}, it automatically checks and runs auto-select if not already run today.`
                }
              </div>

              <button
                className="btn btn-primary btn-full"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? '💾 حفظ الإعدادات' : '💾 Save Settings')}
              </button>
            </div>
          </div>

          {/* ── نتيجة آخر تشغيل ── */}
          <div className="card">
            <div className="card-header">
              <h3>📊 {isAr ? 'نتيجة آخر تشغيل' : 'Last Run Result'}</h3>
            </div>
            <div className="card-body">
              {lastResult ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    {[
                      { val: lastResult.processed, label: isAr ? 'تم اختيارهم' : 'Selected', color: '#16a34a', bg: '#dcfce7' },
                      { val: lastResult.skipped,   label: isAr ? 'تم تخطيهم' : 'Skipped',   color: '#d97706', bg: '#fff7ed' },
                      { val: lastResult.errors,    label: isAr ? 'أخطاء' : 'Errors',         color: '#dc2626', bg: '#fee2e2' },
                    ].map((s, i) => (
                      <div key={i} style={{ textAlign: 'center', padding: '12px', background: s.bg, borderRadius: '8px' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: '0.75rem', color: s.color, fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>
                    📅 {isAr ? 'تاريخ التوصيل:' : 'Delivery date:'} <strong>{fmtDateShort(lastResult.deliveryDate)}</strong>
                    &nbsp;|&nbsp; ⏱️ {lastResult.duration}s
                    &nbsp;|&nbsp; {lastResult.manual ? (isAr ? 'يدوي' : 'Manual') : (isAr ? 'تلقائي' : 'Auto')}
                  </div>
                  {lastResult.details?.length > 0 && (
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {lastResult.details.filter(d => d.status === 'auto-selected').map((d, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between',
                          padding: '6px 10px', background: '#f0fdfa', borderRadius: '6px',
                          marginBottom: '4px', fontSize: '0.82rem',
                        }}>
                          <span style={{ fontWeight: 600 }}>{d.name}</span>
                          <span className="badge badge-green">{isAr ? 'تم' : 'Done'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '32px' }}>
                  <div className="empty-icon">🤖</div>
                  <h3>{isAr ? 'لم يشتغل بعد' : 'Not run yet'}</h3>
                  <p>{isAr ? 'اضغط "تشغيل فوري" لتجربة الـ auto-select' : 'Press "Run Now" to test auto-select'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── سجل التشغيل ── */}
        <div className="card">
          <div
            className="card-header"
            onClick={() => setLogOpen(o => !o)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <h3>📋 {isAr ? 'سجل التشغيل' : 'Run Log'}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-teal">{log.length} {isAr ? 'عملية' : 'runs'}</span>
              <span style={{ color: '#94a3b8', fontSize: '1rem' }}>{logOpen ? '▲' : '▼'}</span>
            </div>
          </div>
          {logOpen && (
            <div className="table-wrapper">
              {log.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <h3>{isAr ? 'لا يوجد سجل بعد' : 'No log yet'}</h3>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{isAr ? 'وقت التشغيل' : 'Run Time'}</th>
                      <th>{isAr ? 'تاريخ التوصيل' : 'Delivery Date'}</th>
                      <th>{isAr ? 'تم اختيارهم' : 'Selected'}</th>
                      <th>{isAr ? 'تخطي' : 'Skipped'}</th>
                      <th>{isAr ? 'أخطاء' : 'Errors'}</th>
                      <th>{isAr ? 'مدة' : 'Duration'}</th>
                      <th>{isAr ? 'النوع' : 'Type'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((entry, i) => (
                      <tr key={i} className="fade-in">
                        <td style={{ fontSize: '0.82rem' }}>{fmtDate(entry.runAt)}</td>
                        <td><strong>{fmtDateShort(entry.deliveryDate)}</strong></td>
                        <td><span style={{ color: '#16a34a', fontWeight: 700 }}>{entry.processed}</span></td>
                        <td style={{ color: '#d97706' }}>{entry.skipped}</td>
                        <td style={{ color: entry.errors > 0 ? '#dc2626' : '#94a3b8' }}>{entry.errors}</td>
                        <td style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{entry.duration}s</td>
                        <td>
                          <span className={`badge ${entry.manual ? 'badge-orange' : 'badge-teal'}`}>
                            {entry.manual ? (isAr ? 'يدوي' : 'Manual') : (isAr ? 'تلقائي' : 'Auto')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── قسم الإجراءات الجماعية ── */}
      <div className="page-body" style={{ paddingTop: 0 }}>
        <div className="card">
          <div className="card-header">
            <h3>⚡ {isAr ? 'الإجراءات الجماعية' : 'Bulk Operations'}</h3>
          </div>
          <div className="card-body">

            {/* Tabs */}
            <div style={{ display:'flex', gap:'4px', marginBottom:'20px', borderBottom:'2px solid #e2e8f0' }}>
              {[
                { key:'freeze',  label: isAr?'❄️ تجميد يوم لكل المشتركين':'❄️ Bulk Freeze Day' },
                { key:'delete',  label: isAr?'🗑 حذف اختيارات الوجبات':'🗑 Clear Meal Selections' },
                { key:'migrate', label: isAr?'🔧 ترحيل الاشتراكات القديمة':'🔧 Migrate Old Subscriptions' },
              ].map(t => (
                <button key={t.key} onClick={() => setBulkTab(t.key)}
                  style={{ padding:'8px 16px', border:'none', background:'none', fontFamily:'var(--font-main)', fontSize:'0.88rem', fontWeight:600, cursor:'pointer',
                    color: bulkTab===t.key?'#0d9488':'#64748b',
                    borderBottom: bulkTab===t.key?'2px solid #0d9488':'2px solid transparent', marginBottom:'-2px' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* وضع التحديد: يوم واحد أو نطاق */}
            <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
              {[{k:'single',l:isAr?'يوم واحد':'Single Day'},{k:'range',l:isAr?'نطاق تواريخ':'Date Range'}].map(m=>(
                <label key={m.k} style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', padding:'6px 14px', borderRadius:'8px', border:`1.5px solid ${bulkMode===m.k?'#0d9488':'#e2e8f0'}`, background:bulkMode===m.k?'#f0fdfa':'white', fontWeight:600, fontSize:'0.85rem' }}>
                  <input type="radio" checked={bulkMode===m.k} onChange={()=>setBulkMode(m.k)} style={{ accentColor:'#0d9488' }} />
                  {m.l}
                </label>
              ))}
            </div>

            {/* التواريخ */}
            <div style={{ display:'flex', gap:'12px', alignItems:'flex-end', flexWrap:'wrap', marginBottom:'16px' }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label className="form-label">{isAr ? (bulkMode==='range'?'من تاريخ':'التاريخ') : (bulkMode==='range'?'From':'Date')}</label>
                <input type="date" className="form-control" value={bulkDate} onChange={e=>setBulkDate(e.target.value)} />
              </div>
              {bulkMode === 'range' && (
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">{isAr?'إلى تاريخ':'To'}</label>
                  <input type="date" className="form-control" value={bulkDateTo} onChange={e=>setBulkDateTo(e.target.value)} min={bulkDate} />
                </div>
              )}
              {bulkMode === 'range' && bulkDate && bulkDateTo && (
                <div style={{ padding:'10px 14px', background:'#f0fdfa', borderRadius:'8px', fontSize:'0.82rem', color:'#0f766e', fontWeight:700 }}>
                  {Math.ceil((new Date(bulkDateTo)-new Date(bulkDate))/(1000*60*60*24))+1} {isAr?'يوم':'days'}
                </div>
              )}
            </div>

            {/* الوصف */}
            {bulkTab === 'freeze' && (
              <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:'8px', padding:'10px 14px', marginBottom:'16px', fontSize:'0.82rem', color:'#92400e' }}>
                ⚠️ {isAr
                  ? 'سيتم تجميد التاريخ المحدد لكل المشتركين النشطين وتمديد اشتراكاتهم تلقائياً تعويضاً عن الأيام المجمدة'
                  : 'Will freeze the selected date(s) for all active subscribers and extend their subscriptions automatically'}
              </div>
            )}
            {bulkTab === 'delete' && (
              <div style={{ background:'#fee2e2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginBottom:'16px', fontSize:'0.82rem', color:'#991b1b' }}>
                ⚠️ {isAr
                  ? 'سيتم حذف اختيارات الوجبات للتاريخ المحدد لكل العملاء — استخدم هذا عند تغيير المنيو'
                  : 'Will clear meal selections for all clients on selected date(s) — use when changing the menu'}
              </div>
            )}

            {/* زر التنفيذ — freeze / delete */}
            {bulkTab !== 'migrate' && (
              <>
                <button
                  className={`btn ${bulkTab==='freeze'?'btn-primary':'btn-danger'}`}
                  onClick={bulkTab==='freeze'?handleBulkFreeze:handleBulkDeleteMeals}
                  disabled={bulkRunning || !bulkDate}
                  style={{ padding:'10px 28px' }}>
                  {bulkRunning
                    ? <><div className="spinner" style={{width:'16px',height:'16px',borderWidth:'2px'}}/> {isAr?'جاري التنفيذ...':'Processing...'}</>
                    : bulkTab==='freeze'
                      ? `❄️ ${isAr?'تجميد للكل':'Freeze for All'}`
                      : `🗑 ${isAr?'حذف الاختيارات':'Clear Selections'}`}
                </button>
                {bulkResult && (
                  <div style={{ marginTop:'16px', padding:'14px', background:'#f0fdfa', borderRadius:'10px', border:'1px solid #ccfbf1' }}>
                    <div style={{ fontWeight:700, color:'#0d9488', marginBottom:'6px' }}>{isAr?'نتيجة العملية:':'Result:'}</div>
                    <div style={{ fontSize:'0.85rem', color:'#0f766e' }}>
                      {bulkTab==='freeze'
                        ? `✅ ${isAr?`تم تجميد ${bulkResult.dates?.length} يوم لـ ${bulkResult.count} مشترك وتمديد اشتراكاتهم تلقائياً`:`Frozen ${bulkResult.dates?.length} day(s) for ${bulkResult.count} subscribers`}`
                        : `✅ ${isAr?`تم حذف اختيارات ${bulkResult.count} عميل`:`Cleared ${bulkResult.count} client selections`}`}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── تبويب الترحيل ── */}
            {bulkTab === 'migrate' && (
              <div>
                <div style={{ background:'#fef9c3', border:'1px solid #fde68a', borderRadius:'10px', padding:'14px 16px', marginBottom:'16px', fontSize:'0.85rem', color:'#92400e' }}>
                  <strong>🔧 {isAr?'ما الذي يفعله هذا؟':'What does this do?'}</strong>
                  <br/>
                  {isAr
                    ? 'يبحث عن الاشتراكات القديمة التي ليس بها حقل "أيام التوصيل" ويضيفه تلقائياً من إعدادات الباقة. الباقات التي تشمل الجمعة → 7 أيام، غير ذلك → 6 أيام (بدون جمعة).'
                    : 'Finds old subscriptions missing the "deliveryDays" field and sets it from the package settings. Packages with Fridays → 7 days, otherwise → 6 days (no Friday).'}
                </div>

                <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => handleMigrateDeliveryDays(true)}
                    disabled={migrateRunning}
                    style={{ padding:'10px 24px' }}>
                    {migrateRunning
                      ? <><div className="spinner" style={{width:'16px',height:'16px',borderWidth:'2px'}}/> {isAr?'جاري...':'Loading...'}</>
                      : `🔍 ${isAr?'معاينة (كم اشتراك يحتاج تحديث؟)':'Preview (how many need update?)'}`}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleMigrateDeliveryDays(false)}
                    disabled={migrateRunning}
                    style={{ padding:'10px 24px' }}>
                    {migrateRunning
                      ? <><div className="spinner" style={{width:'16px',height:'16px',borderWidth:'2px'}}/> {isAr?'جاري التحديث...':'Updating...'}</>
                      : `✅ ${isAr?'تطبيق التحديث على الكل':'Apply Update to All'}`}
                  </button>
                </div>

                {migrateResult && (
                  <div style={{ marginTop:'16px', padding:'14px', background: migrateResult.preview?'#f8fafc':'#f0fdfa', borderRadius:'10px', border:`1px solid ${migrateResult.preview?'#e2e8f0':'#ccfbf1'}` }}>
                    {migrateResult.preview ? (
                      <>
                        <div style={{ fontWeight:700, color:'#0f172a', marginBottom:'10px' }}>
                          🔍 {isAr?`وُجد ${migrateResult.count} اشتراك يحتاج إلى تحديث`:`Found ${migrateResult.count} subscriptions needing update`}
                        </div>
                        {migrateResult.subs?.length > 0 && (
                          <div style={{ fontSize:'0.78rem', color:'#64748b' }}>
                            {isAr?'أمثلة:':'Examples:'}&nbsp;
                            {migrateResult.subs.map(s => s.clientName || s.clientId).join(' ، ')}
                            {migrateResult.count > 10 && ` ... ${isAr?'وغيرهم':'and more'}`}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontWeight:700, color:'#0d9488' }}>
                        ✅ {isAr?`تم تحديث ${migrateResult.count} اشتراك بنجاح`:`Successfully updated ${migrateResult.count} subscriptions`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
