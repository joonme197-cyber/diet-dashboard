import { useState, useEffect } from 'react';
import {
  getAutoSelectSettings, saveAutoSelectSettings,
  runAutoSelect, getAutoSelectLog, checkAndRunScheduled,
} from '../firebase/autoSelectService';
import { useLang } from '../LanguageContext';

export default function AutoSelectPage() {
  const { isAr } = useLang();

  const [settings, setSettings]   = useState(null);
  const [log, setLog]             = useState([]);
  const [loading, setLoading]     = useState(true);
  const [running, setRunning]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState({ text: '', type: '' });
  const [lastResult, setLastResult] = useState(null);

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
          <div className="card-header">
            <h3>📋 {isAr ? 'سجل التشغيل' : 'Run Log'}</h3>
            <span className="badge badge-teal">{log.length} {isAr ? 'عملية' : 'runs'}</span>
          </div>
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
                      <td>
                        <span style={{ color: '#16a34a', fontWeight: 700 }}>{entry.processed}</span>
                      </td>
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
        </div>
      </div>
    </div>
  );
}
