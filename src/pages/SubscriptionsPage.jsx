import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getAllSubscriptions, getSubscriptionStatus, getStatusLabel, updateSubscription } from '../firebase/subscriptionService';
import { useLang } from '../LanguageContext';

const isExpiringSoon = (sub) => {
  if (getSubscriptionStatus(sub) !== 'active') return false;
  const daysLeft = Math.ceil((new Date(sub.endDate) - new Date()) / (1000*60*60*24));
  return daysLeft <= 7 && daysLeft >= 0;
};
const isFrozen = (sub) => getSubscriptionStatus(sub) === 'active' && (sub.frozenDays||[]).length > 0;
const getEffectiveStatus = (sub) => {
  if (sub.status === 'pending') return 'pending';
  if (isFrozen(sub)) return 'frozen';
  if (isExpiringSoon(sub)) return 'expiring';
  return getSubscriptionStatus(sub);
};

function SubDetailModal({ sub, onClose, isAr }) {
  if (!sub) return null;
  const status   = getSubscriptionStatus(sub);
  const stl      = getStatusLabel(status);
  const frozen   = isFrozen(sub);
  const expiring = isExpiringSoon(sub);
  const daysLeft = Math.max(0, Math.ceil((new Date(sub.endDate) - new Date()) / (1000*60*60*24)));

  const row = (label, value, color) => (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f1f5f9' }}>
      <span style={{ color:'#64748b', fontSize:'0.85rem' }}>{label}</span>
      <span style={{ fontWeight:700, fontSize:'0.88rem', color: color||'#1e293b' }}>{value}</span>
    </div>
  );

  const statusLabel = frozen
    ? (isAr ? '❄ مجمد' : '❄ Frozen')
    : expiring
      ? (isAr ? '⚠ قيد الانتهاء' : '⚠ Expiring Soon')
      : stl.label;

  return (
    <div className="modal-overlay no-print" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:'520px' }}>
        <div className="modal-header">
          <h3>📋 {isAr ? 'تفاصيل الاشتراك' : 'Subscription Details'}</h3>
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨️ {isAr ? 'طباعة' : 'Print'}</button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          <div className="print-only" style={{ display:'none', marginBottom:'20px', textAlign:'center' }}>
            <h2 style={{ color:'#0d9488' }}>🥗 Diet Plan — {isAr ? 'تفاصيل الاشتراك' : 'Subscription Details'}</h2>
          </div>

          <div style={{ textAlign:'center', marginBottom:'20px' }}>
            <span style={{ background: frozen?'#ede9fe':expiring?'#fff7ed':stl.bg, color: frozen?'#7c3aed':expiring?'#d97706':stl.color, padding:'6px 20px', borderRadius:'999px', fontWeight:800, fontSize:'0.95rem' }}>
              {statusLabel}
            </span>
          </div>

          <div style={{ background:'#f0fdfa', borderRadius:'10px', padding:'14px', marginBottom:'16px' }}>
            <div style={{ fontWeight:800, fontSize:'1rem', color:'#0d9488', marginBottom:'8px' }}>👤 {isAr ? 'بيانات العميل' : 'Client Info'}</div>
            {row(isAr ? 'الاسم' : 'Name', sub.clientName)}
            {row(isAr ? 'الكود' : 'Code', sub.clientCode)}
          </div>

          <div style={{ background:'#f8fafc', borderRadius:'10px', padding:'14px', marginBottom:'16px' }}>
            <div style={{ fontWeight:800, fontSize:'1rem', color:'#1e293b', marginBottom:'8px' }}>📦 {isAr ? 'بيانات الاشتراك' : 'Subscription Info'}</div>
            {row(isAr ? 'الباقة' : 'Package', sub.packageName)}
            {row(isAr ? 'النوع' : 'Type', sub.bundleType==='normal' ? (isAr?'باقة ثابتة':'Fixed') : (isAr?'باقة مرنة':'Flex'))}
            {row(isAr ? 'تاريخ البدء' : 'Start Date', sub.startDate)}
            {row(isAr ? 'تاريخ الانتهاء' : 'End Date', sub.endDate)}
            {row(isAr ? 'المدة' : 'Duration', `${sub.durationWeeks} ${isAr?'أسابيع':'weeks'}`)}
            {status==='active' && row(isAr?'الأيام المتبقية':'Days Left', `${daysLeft} ${isAr?'يوم':'days'}`, daysLeft<=7?'#d97706':'#16a34a')}
          </div>

          <div style={{ background:'#f8fafc', borderRadius:'10px', padding:'14px', marginBottom:'16px' }}>
            <div style={{ fontWeight:800, fontSize:'1rem', color:'#1e293b', marginBottom:'8px' }}>💪 {isAr ? 'المعلومات الغذائية' : 'Nutritional Info'}</div>
            {row('Protein', `${sub.protein}g`)}
            {row('Carbs', `${sub.carbs}g`)}
            {row(isAr?'الوجبات':'Meals', `${sub.mealsNumber||0} + ${sub.snacksNumber||0} ${isAr?'سناك':'snacks'}`)}
            {sub.allowedBreakfast && row(isAr?'الفطور':'Breakfast', `${sub.allowedBreakfast}`)}
            {sub.allowedLunch     && row(isAr?'الغداء':'Lunch',     `${sub.allowedLunch}`)}
            {sub.allowedDinner    && row(isAr?'العشاء':'Dinner',    `${sub.allowedDinner}`)}
          </div>

          <div style={{ background:'#f8fafc', borderRadius:'10px', padding:'14px', marginBottom:'16px' }}>
            <div style={{ fontWeight:800, fontSize:'1rem', color:'#1e293b', marginBottom:'8px' }}>💰 {isAr ? 'الدفع' : 'Payment'}</div>
            {row(isAr?'حالة الدفع':'Payment Status',
              sub.paymentStatus==='paid' ? (isAr?'مدفوع':'Paid') : (isAr?'آجل':'Pending'),
              sub.paymentStatus==='paid' ? '#16a34a' : '#d97706')}
            {sub.finalPrice    && row(isAr?'السعر النهائي':'Final Price', `${Number(sub.finalPrice).toFixed(3)} KWD`)}
            {sub.originalPrice && sub.discountAmount && row(isAr?'الخصم':'Discount', `${Number(sub.discountAmount).toFixed(3)} KWD`, '#dc2626')}
            {sub.couponCode    && row(isAr?'كوبون الخصم':'Coupon', sub.couponCode, '#0d9488')}
            {(sub.payments||[]).map((p,i) => row(`${isAr?'دفعة':'Payment'} ${i+1}`, `${p.amount} KWD — ${p.method} (${p.date})`))}
          </div>

          {(sub.frozenDays||[]).length > 0 && (
            <div style={{ background:'#faf5ff', borderRadius:'10px', padding:'14px', marginBottom:'16px' }}>
              <div style={{ fontWeight:800, fontSize:'1rem', color:'#7c3aed', marginBottom:'8px' }}>
                ❄ {isAr?'أيام التجميد':'Frozen Days'} ({sub.frozenDays.length})
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {sub.frozenDays.map(d => (
                  <span key={d} style={{ background:'#ede9fe', color:'#7c3aed', padding:'2px 8px', borderRadius:'6px', fontSize:'0.78rem', fontWeight:600 }}>{d}</span>
                ))}
              </div>
            </div>
          )}

          {sub.notes && (
            <div style={{ background:'#fffbeb', borderRadius:'10px', padding:'14px' }}>
              <div style={{ fontWeight:800, fontSize:'1rem', color:'#d97706', marginBottom:'4px' }}>📝 {isAr?'ملاحظات':'Notes'}</div>
              <div style={{ fontSize:'0.88rem', color:'#1e293b' }}>{sub.notes}</div>
            </div>
          )}

          <div style={{ display:'flex', gap:'10px', marginTop:'20px' }}>
            <button className="btn btn-primary" style={{ flex:1 }} onClick={() => window.print()}>🖨️ {isAr?'طباعة':'Print'}</button>
            <Link to={`/clients/${sub.clientId}`} className="btn btn-outline" style={{ flex:1, textAlign:'center' }}>
              👤 {isAr?'ملف العميل':'Client Profile'}
            </Link>
          </div>
        </div>
      </div>
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } @page { size: A4; margin: 15mm; } }`}</style>
    </div>
  );
}

export default function SubscriptionsPage() {
  const { isAr, t } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subscriptions, setSubscriptions] = useState([]);
  const [packages, setPackages]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState('');
  const [packageFilter, setPackageFilter] = useState('');
  const [selectedSub, setSelectedSub]     = useState(null);
  const [confirmingId, setConfirmingId]   = useState('');
  const [msg, setMsg]                     = useState('');

  const TABS = [
    { key: 'all',       labelAr: 'الكل',           labelEn: 'All' },
    { key: 'pending',   labelAr: '⏳ معلق',         labelEn: '⏳ Pending' },
    { key: 'active',    labelAr: 'نشط',             labelEn: 'Active' },
    { key: 'upcoming',  labelAr: 'قادم',            labelEn: 'Upcoming' },
    { key: 'expiring',  labelAr: 'قيد الانتهاء',    labelEn: 'Expiring' },
    { key: 'expired',   labelAr: 'منتهي',           labelEn: 'Expired' },
    { key: 'cancelled', labelAr: 'ملغي',            labelEn: 'Cancelled' },
    { key: 'frozen',    labelAr: 'مجمد',            labelEn: 'Frozen' },
  ];

  const tabLabel = (tab) => isAr ? tab.labelAr : tab.labelEn;

  const STAT_CARDS = [
    { key:'pending',  labelAr:'معلق ⏳',        labelEn:'Pending',       color:'#d97706', bg:'#fff7ed' },
    { key:'active',   labelAr:'نشط',            labelEn:'Active',        color:'#16a34a', bg:'#dcfce7' },
    { key:'expiring', labelAr:'قيد الانتهاء',   labelEn:'Expiring',      color:'#d97706', bg:'#fff7ed' },
    { key:'upcoming', labelAr:'قادم',           labelEn:'Upcoming',      color:'#0d9488', bg:'#f0fdfa' },
    { key:'expired',  labelAr:'منتهي',          labelEn:'Expired',       color:'#dc2626', bg:'#fee2e2' },
    { key:'cancelled',labelAr:'ملغي',           labelEn:'Cancelled',     color:'#64748b', bg:'#f1f5f9' },
    { key:'frozen',   labelAr:'مجمد',           labelEn:'Frozen',        color:'#7c3aed', bg:'#ede9fe' },
  ];

  const showMsg = (m) => { setMsg(m); setTimeout(()=>setMsg(''), 3000); };

  const load = () => getAllSubscriptions().then(data => {
    setSubscriptions(data);
    setPackages([...new Set(data.map(s => s.packageName).filter(Boolean))].sort());
    setLoading(false);
  });

  const confirmPayment = async (sub) => {
    if (!window.confirm(`${isAr?'تأكيد دفع اشتراك':'Confirm payment for'} ${sub.clientName}؟`)) return;
    setConfirmingId(sub.id);
    await updateSubscription(sub.id, {
      status: 'active', paymentStatus: 'paid',
      payments: [...(sub.payments||[]), {
        method: sub.paymentMethod || 'واتساب',
        amount: sub.finalPrice || sub.originalPrice || 0,
        date: new Date().toISOString().split('T')[0],
      }],
    });
    setConfirmingId('');
    showMsg(`✅ ${isAr?'تم تفعيل اشتراك':'Activated subscription for'} ${sub.clientName}`);
    load();
  };

  const statusParam = searchParams.get('status') || 'all';
  const activeTab   = TABS.find(tab => tab.key === statusParam) ? statusParam : 'all';

  const setTab = (key) => {
    const p = new URLSearchParams(searchParams);
    if (key === 'all') p.delete('status'); else p.set('status', key);
    setSearchParams(p);
  };

  useEffect(() => { load(); }, []);

  const filtered = subscriptions.filter(s => {
    const eff = getEffectiveStatus(s);
    return (activeTab === 'all' || eff === activeTab) &&
      (!search || s.clientName?.includes(search) || s.packageName?.includes(search)) &&
      (!packageFilter || s.packageName === packageFilter);
  });

  const countByKey = (key) =>
    key === 'all' ? subscriptions.length : subscriptions.filter(s => getEffectiveStatus(s) === key).length;

  const activeTabObj = TABS.find(tab => tab.key === activeTab);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>📋 {isAr ? 'إدارة الاشتراكات' : 'Subscriptions'}</h2>
          <div className="breadcrumb">
            {tabLabel(activeTabObj || TABS[0])}
            {packageFilter && ` — ${packageFilter}`}
          </div>
        </div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <select className="form-control" style={{ width:'180px' }} value={packageFilter}
            onChange={e => setPackageFilter(e.target.value)}>
            <option value="">{isAr ? 'كل الباقات' : 'All Packages'}</option>
            {packages.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input className="form-control" style={{ width:'220px' }}
            placeholder={isAr ? 'بحث بالاسم أو الباقة...' : 'Search by name or package...'}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'12px', marginBottom:'20px' }}>
          {STAT_CARDS.map(s => (
            <div key={s.key} className="stat-card" style={{ cursor:'pointer', border: activeTab===s.key?`2px solid ${s.color}`:'2px solid transparent' }}
              onClick={() => setTab(s.key)}>
              <div className="stat-icon" style={{ background:s.bg }}>
                <span style={{ color:s.color, fontSize:'1.1rem' }}>📋</span>
              </div>
              <div className="stat-info">
                <h3 style={{ color:s.color }}>{countByKey(s.key)}</h3>
                <p>{isAr ? s.labelAr : s.labelEn}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:'4px', marginBottom:'16px', borderBottom:'2px solid #e2e8f0', overflowX:'auto' }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setTab(tab.key)} style={{
              padding:'8px 14px', border:'none', background:'none',
              fontFamily:'var(--font-main)', fontSize:'0.85rem', fontWeight:600,
              cursor:'pointer', whiteSpace:'nowrap',
              color: activeTab===tab.key ? '#0d9488' : '#64748b',
              borderBottom: activeTab===tab.key ? '2px solid #0d9488' : '2px solid transparent',
              marginBottom:'-2px',
            }}>
              {tabLabel(tab)}
              <span style={{ marginRight:'4px', fontSize:'0.7rem', background:'#f1f5f9', padding:'1px 6px', borderRadius:'999px' }}>
                {countByKey(tab.key)}
              </span>
            </button>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>
              {tabLabel(activeTabObj || TABS[0])}
              {packageFilter && ` — ${packageFilter}`}
            </h3>
            <span className="badge badge-teal">{filtered.length} {isAr?'اشتراك':'subscriptions'}</span>
          </div>
          <div className="table-wrapper">
            {loading ? (
              <div className="loading"><div className="spinner" />{t('loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>{isAr ? 'لا يوجد اشتراكات' : 'No subscriptions found'}</h3>
              </div>
            ) : (
              <table>
                <thead><tr>
                  <th>{isAr?'العميل':'Client'}</th>
                  <th>{isAr?'الباقة':'Package'}</th>
                  <th>{isAr?'تاريخ البدء':'Start Date'}</th>
                  <th>{isAr?'تاريخ الانتهاء':'End Date'}</th>
                  <th>{isAr?'المدة':'Duration'}</th>
                  <th>{isAr?'الدفع':'Payment'}</th>
                  <th>{isAr?'الحالة':'Status'}</th>
                  <th>{isAr?'الإجراءات':'Actions'}</th>
                </tr></thead>
                <tbody>
                  {filtered.map(sub => {
                    const status   = getSubscriptionStatus(sub);
                    const stl      = getStatusLabel(status);
                    const daysLeft = Math.max(0, Math.ceil((new Date(sub.endDate) - new Date()) / (1000*60*60*24)));
                    const frozen   = isFrozen(sub);
                    const expiring = isExpiringSoon(sub);
                    return (
                      <tr key={sub.id} className="fade-in"
                        onClick={() => setSelectedSub(sub)}
                        style={{ background: expiring?'#fffbeb': frozen?'#faf5ff':'white', cursor:'pointer' }}>
                        <td>
                          <strong>{sub.clientName}</strong>
                          {frozen   && <div style={{ fontSize:'0.72rem', color:'#7c3aed' }}>❄ {sub.frozenDays.length} {isAr?'يوم مجمد':'frozen days'}</div>}
                          {expiring && !frozen && <div style={{ fontSize:'0.72rem', color:'#d97706' }}>⚠ {isAr?'قيد الانتهاء':'Expiring soon'}</div>}
                        </td>
                        <td>
                          <span className={`badge ${sub.bundleType==='normal'?'badge-green':'badge-orange'}`}>
                            {sub.packageName}
                          </span>
                        </td>
                        <td>{sub.startDate}</td>
                        <td>{sub.endDate}</td>
                        <td style={{ fontSize:'0.82rem' }}>
                          {sub.durationWeeks} {isAr?'أسابيع':'wks'}
                          {status==='active' && (
                            <div style={{ color: expiring?'#d97706':'#0d9488', fontWeight:600 }}>
                              {daysLeft} {isAr?'يوم':'days'}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${sub.paymentStatus==='paid'?'badge-green':'badge-orange'}`}>
                            {sub.paymentStatus==='paid' ? (isAr?'مدفوع':'Paid') : (isAr?'آجل':'Pending')}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize:'0.78rem', fontWeight:700, padding:'3px 10px', borderRadius:'999px',
                            color: frozen?'#7c3aed': expiring?'#d97706': stl.color,
                            background: frozen?'#ede9fe': expiring?'#fff7ed': stl.bg,
                          }}>
                            {frozen ? (isAr?'❄ مجمد':'❄ Frozen') : expiring ? (isAr?'⚠ قيد الانتهاء':'⚠ Expiring') : stl.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                            {sub.status === 'pending' && (
                              <button className="btn btn-sm"
                                style={{ background:'#16a34a', color:'white', border:'none', cursor:'pointer', fontFamily:'var(--font-main)', fontWeight:700, padding:'6px 12px', borderRadius:'6px', whiteSpace:'nowrap' }}
                                onClick={e => { e.stopPropagation(); confirmPayment(sub); }}
                                disabled={confirmingId === sub.id}>
                                {confirmingId === sub.id ? '⏳...' : (isAr?'✅ تأكيد الدفع':'✅ Confirm Payment')}
                              </button>
                            )}
                            <Link to={`/clients/${sub.clientId}`} className="btn btn-outline btn-sm"
                              onClick={e => e.stopPropagation()}>
                              {isAr?'ملف العميل':'Profile'}
                            </Link>
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

      {selectedSub && <SubDetailModal sub={selectedSub} onClose={() => setSelectedSub(null)} isAr={isAr} />}
    </div>
  );
}
