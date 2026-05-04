import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getClients } from '../firebase/clientService';
import { getAllSubscriptions, getSubscriptionStatus } from '../firebase/subscriptionService';
import { useLang } from '../LanguageContext';

export default function Dashboard() {
  const { isAr, t } = useLang();
  const [clients, setClients] = useState([]);
  const [subs, setSubs]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getClients(), getAllSubscriptions()])
      .then(([c, s]) => { setClients(c); setSubs(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const getActiveSub = (clientId) =>
    subs.find(s => s.clientId === clientId && getSubscriptionStatus(s) === 'active');

  const today = new Date().toLocaleDateString(isAr ? 'ar-KW' : 'en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const quickActions = [
    { icon: '➕', label: isAr ? 'إضافة عميل جديد' : 'Add New Client',   path: '/clients/add', color: '#14b8a6' },
    { icon: '👥', label: isAr ? 'قائمة العملاء'    : 'Clients List',      path: '/clients',     color: '#3b82f6' },
    { icon: '🏷️', label: isAr ? 'طباعة الملصقات'  : 'Print Labels',      path: '/labels',      color: '#f59e0b' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🏠 {isAr ? 'لوحة التحكم الرئيسية' : 'Main Dashboard'}</h2>
          <div className="breadcrumb">📅 {today}</div>
        </div>
        <Link to="/clients/add" className="btn btn-primary">
          ➕ {isAr ? 'إضافة عميل جديد' : 'Add New Client'}
        </Link>
      </div>

      <div className="page-body">
        {/* Welcome card */}
        <div style={{
          background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)',
          borderRadius: '16px', padding: '28px 32px', color: 'white',
          marginBottom: '24px', position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '8px' }}>
              🥗 {isAr ? 'نظام إدارة اشتراكات الوجبات الصحية' : 'Healthy Meal Subscription Management System'}
            </h2>
            <p style={{ opacity: 0.85, fontSize: '0.95rem' }}>
              {isAr
                ? 'إدارة متكاملة للعملاء، الباقات، والوجبات اليومية'
                : 'Integrated management for clients, packages, and daily meals'}
            </p>
          </div>
          <div style={{ position:'absolute', left:'-20px', top:'-20px', width:'200px', height:'200px', background:'rgba(255,255,255,0.05)', borderRadius:'50%' }} />
          <div style={{ position:'absolute', left:'80px', bottom:'-40px', width:'150px', height:'150px', background:'rgba(255,255,255,0.05)', borderRadius:'50%' }} />
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon teal">👥</div>
            <div className="stat-info">
              <h3>{loading ? '...' : clients.length}</h3>
              <p>{isAr ? 'إجمالي العملاء' : 'Total Clients'}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue">✅</div>
            <div className="stat-info">
              <h3>{loading ? '...' : subs.filter(s => getSubscriptionStatus(s) === 'active' && s.bundleType === 'normal').length}</h3>
              <p>{isAr ? 'باقات ثابتة نشطة' : 'Active Fixed Packages'}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">✨</div>
            <div className="stat-info">
              <h3>{loading ? '...' : subs.filter(s => getSubscriptionStatus(s) === 'active' && s.bundleType !== 'normal').length}</h3>
              <p>{isAr ? 'باقات مرنة نشطة' : 'Active Flex Packages'}</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">🏷️</div>
            <div className="stat-info">
              <h3>{loading ? '...' : clients.length}</h3>
              <p>{isAr ? 'استيكر للطباعة اليوم' : "Today's Print Labels"}</p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3>⚡ {isAr ? 'الإجراءات السريعة' : 'Quick Actions'}</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {quickActions.map(action => (
                <Link key={action.path} to={action.path} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '16px', borderRadius: '10px', border: '1.5px solid #e2e8f0',
                  textDecoration: 'none', color: '#1e293b', transition: 'all 0.2s', background: 'white'
                }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = action.color; e.currentTarget.style.background = '#f0fdfa'; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{action.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{action.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Recent clients */}
        <div className="card">
          <div className="card-header">
            <h3>🕐 {isAr ? 'آخر العملاء المضافين' : 'Recently Added Clients'}</h3>
            <Link to="/clients" className="btn btn-outline btn-sm">
              {isAr ? 'عرض الكل' : 'View All'}
            </Link>
          </div>
          <div className="table-wrapper">
            {loading ? (
              <div className="loading"><div className="spinner" />{t('loading')}</div>
            ) : clients.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>{isAr ? 'لا يوجد عملاء بعد' : 'No clients yet'}</h3>
                <p>{isAr ? 'ابدأ بإضافة أول عميل' : 'Start by adding your first client'}</p>
                <Link to="/clients/add" className="btn btn-primary" style={{ marginTop: '12px' }}>
                  ➕ {isAr ? 'إضافة عميل' : 'Add Client'}
                </Link>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{isAr ? 'الكود' : 'Code'}</th>
                    <th>{isAr ? 'الاسم' : 'Name'}</th>
                    <th>{isAr ? 'الهاتف' : 'Phone'}</th>
                    <th>{isAr ? 'نوع الباقة' : 'Bundle Type'}</th>
                    <th>{isAr ? 'المنطقة' : 'Region'}</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.slice(0, 5).map(c => {
                    const activeSub = getActiveSub(c.id);
                    const bType = activeSub?.bundleType;
                    return (
                      <tr key={c.id}>
                        <td><span className="badge badge-teal">{c.clientCode}</span></td>
                        <td><strong>{c.name}</strong></td>
                        <td>{c.phone}</td>
                        <td>
                          {bType ? (
                            <span className={`badge ${bType === 'normal' ? 'badge-green' : 'badge-orange'}`}>
                              {bType === 'normal'
                                ? (isAr ? '📦 ثابتة' : '📦 Fixed')
                                : (isAr ? '✨ مرنة' : '✨ Flex')}
                            </span>
                          ) : (
                            <span className="badge" style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td>{c.governorate} {c.region && `/ ${c.region}`}</td>
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
