import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllSubscriptions } from '../firebase/subscriptionService';
import { getSubscriptionStatus, getStatusLabel } from '../firebase/subscriptionService';

const STATUS_TABS = ['الكل', 'نشط', 'قادم', 'منتهي', 'ملغي'];
const STATUS_MAP = { 'نشط': 'active', 'قادم': 'upcoming', 'منتهي': 'expired', 'ملغي': 'cancelled' };

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('الكل');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAllSubscriptions().then(data => {
      setSubscriptions(data);
      setLoading(false);
    });
  }, []);

  const filtered = subscriptions.filter(s => {
    const status = getSubscriptionStatus(s);
    const matchTab = activeTab === 'الكل' || status === STATUS_MAP[activeTab];
    const matchSearch = s.clientName?.includes(search) || s.packageName?.includes(search);
    return matchTab && matchSearch;
  });

  const countByStatus = (st) => subscriptions.filter(s => getSubscriptionStatus(s) === st).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>إدارة الاشتراكات</h2>
          <div className="breadcrumb">كل الاشتراكات</div>
        </div>
        <input className="form-control" style={{ width: '250px' }}
          placeholder="بحث بالاسم أو الباقة..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: '20px' }}>
          {[
            { label: 'نشط', status: 'active', color: '#16a34a', bg: '#dcfce7' },
            { label: 'قادم', status: 'upcoming', color: '#0d9488', bg: '#f0fdfa' },
            { label: 'منتهي', status: 'expired', color: '#dc2626', bg: '#fee2e2' },
            { label: 'إجمالي', status: null, color: '#0d9488', bg: '#f0fdfa' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background: s.bg }}>
                <span style={{ color: s.color, fontSize: '1.2rem' }}>📋</span>
              </div>
              <div className="stat-info">
                <h3 style={{ color: s.color }}>{s.status ? countByStatus(s.status) : subscriptions.length}</h3>
                <p>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '0' }}>
          {STATUS_TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px', border: 'none', background: 'none',
                fontFamily: 'var(--font-main)', fontSize: '0.88rem', fontWeight: 600,
                cursor: 'pointer', color: activeTab === tab ? '#0d9488' : '#64748b',
                borderBottom: activeTab === tab ? '2px solid #0d9488' : '2px solid transparent',
                marginBottom: '-2px',
              }}
            >
              {tab}
              {tab !== 'الكل' && STATUS_MAP[tab] && (
                <span style={{ marginRight: '4px', fontSize: '0.72rem', background: '#f1f5f9', padding: '1px 6px', borderRadius: '999px' }}>
                  {countByStatus(STATUS_MAP[tab])}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="card">
          <div className="table-wrapper">
            {loading ? (
              <div className="loading"><div className="spinner" />جاري التحميل...</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>لا يوجد اشتراكات</h3>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>العميل</th>
                    <th>الباقة</th>
                    <th>تاريخ البدء</th>
                    <th>تاريخ الانتهاء</th>
                    <th>المدة</th>
                    <th>الدفع</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(sub => {
                    const status = getSubscriptionStatus(sub);
                    const stl = getStatusLabel(status);
                    const daysLeft = Math.max(0, Math.ceil((new Date(sub.endDate) - new Date()) / (1000*60*60*24)));
                    return (
                      <tr key={sub.id} className="fade-in">
                        <td>
                          <strong>{sub.clientName}</strong>
                          {(sub.frozenDays||[]).length > 0 && (
                            <div style={{ fontSize: '0.72rem', color: '#d97706' }}>❄ {sub.frozenDays.length} مجمد</div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${sub.bundleType === 'normal' ? 'badge-green' : 'badge-orange'}`}>
                            {sub.packageName}
                          </span>
                        </td>
                        <td>{sub.startDate}</td>
                        <td>{sub.endDate}</td>
                        <td style={{ fontSize: '0.82rem' }}>
                          {sub.durationWeeks} أسابيع
                          {status === 'active' && <div style={{ color: '#0d9488', fontWeight: 600 }}>{daysLeft} يوم</div>}
                        </td>
                        <td>
                          <span className={`badge ${sub.paymentStatus === 'paid' ? 'badge-green' : 'badge-orange'}`}>
                            {sub.paymentStatus === 'paid' ? 'مدفوع' : 'آجل'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: stl.color, background: stl.bg, padding: '3px 10px', borderRadius: '999px' }}>
                            {stl.label}
                          </span>
                        </td>
                        <td>
                          <Link to={`/clients/${sub.clientId}`} className="btn btn-outline btn-sm">
                            ملف العميل
                          </Link>
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
    </div>
  );
}
