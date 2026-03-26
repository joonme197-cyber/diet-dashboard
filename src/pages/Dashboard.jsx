import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getClients } from '../firebase/clientService';

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getClients().then(data => {
      setClients(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString('ar-KW', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🏠 لوحة التحكم الرئيسية</h2>
          <div className="breadcrumb">📅 {today}</div>
        </div>
        <Link to="/clients/add" className="btn btn-primary">
          ➕ إضافة عميل جديد
        </Link>
      </div>

      <div className="page-body">
        {/* Welcome card */}
        <div style={{
          background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)',
          borderRadius: '16px',
          padding: '28px 32px',
          color: 'white',
          marginBottom: '24px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '8px' }}>
              🥗 نظام إدارة اشتراكات الوجبات الصحية
            </h2>
            <p style={{ opacity: 0.85, fontSize: '0.95rem' }}>
              إدارة متكاملة للعملاء، الباقات، والوجبات اليومية
            </p>
          </div>
          <div style={{
            position: 'absolute', left: '-20px', top: '-20px',
            width: '200px', height: '200px', background: 'rgba(255,255,255,0.05)',
            borderRadius: '50%'
          }} />
          <div style={{
            position: 'absolute', left: '80px', bottom: '-40px',
            width: '150px', height: '150px', background: 'rgba(255,255,255,0.05)',
            borderRadius: '50%'
          }} />
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon teal">👥</div>
            <div className="stat-info">
              <h3>{loading ? '...' : clients.length}</h3>
              <p>إجمالي العملاء</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue">✅</div>
            <div className="stat-info">
              <h3>{loading ? '...' : clients.filter(c => c.bundleType === 'normal').length}</h3>
              <p>باقات ثابتة نشطة</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange">✨</div>
            <div className="stat-info">
              <h3>{loading ? '...' : clients.filter(c => c.bundleType === 'custom').length}</h3>
              <p>باقات مرنة نشطة</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">🏷️</div>
            <div className="stat-info">
              <h3>{loading ? '...' : clients.length}</h3>
              <p>استيكر للطباعة اليوم</p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3>⚡ الإجراءات السريعة</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { icon: '➕', label: 'إضافة عميل جديد', path: '/clients/add', color: '#14b8a6' },
                { icon: '👥', label: 'قائمة العملاء', path: '/clients', color: '#3b82f6' },
                { icon: '🏷️', label: 'طباعة الملصقات', path: '/labels', color: '#f59e0b' },
              ].map(action => (
                <Link
                  key={action.path}
                  to={action.path}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '16px', borderRadius: '10px', border: '1.5px solid #e2e8f0',
                    textDecoration: 'none', color: '#1e293b', transition: 'all 0.2s',
                    background: 'white'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.borderColor = action.color;
                    e.currentTarget.style.background = '#f0fdfa';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = 'white';
                  }}
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
            <h3>🕐 آخر العملاء المضافين</h3>
            <Link to="/clients" className="btn btn-outline btn-sm">عرض الكل</Link>
          </div>
          <div className="table-wrapper">
            {loading ? (
              <div className="loading"><div className="spinner" />جاري التحميل...</div>
            ) : clients.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>لا يوجد عملاء بعد</h3>
                <p>ابدأ بإضافة أول عميل</p>
                <Link to="/clients/add" className="btn btn-primary" style={{ marginTop: '12px' }}>
                  ➕ إضافة عميل
                </Link>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>الكود</th>
                    <th>الاسم</th>
                    <th>الهاتف</th>
                    <th>نوع الباقة</th>
                    <th>المنطقة</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.slice(0, 5).map(c => (
                    <tr key={c.id}>
                      <td><span className="badge badge-teal">{c.clientCode}</span></td>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.phone}</td>
                      <td>
                        <span className={`badge ${c.bundleType === 'normal' ? 'badge-green' : 'badge-orange'}`}>
                          {c.bundleType === 'normal' ? '📦 ثابتة' : '✨ مرنة'}
                        </span>
                      </td>
                      <td>{c.governorate} {c.region && `/ ${c.region}`}</td>
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
