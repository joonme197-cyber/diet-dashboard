import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../LanguageContext';

export default function Sidebar() {
  const location = useLocation();
  const { lang, toggleLang, t } = useLang();
  const isAr = lang === 'ar';

  const navItems = [
    { icon: '🏠', label: isAr ? 'الرئيسية' : 'Home', path: '/' },
    { icon: '👥', label: isAr ? 'العملاء' : 'Clients', path: '/clients', sub: [
      { label: isAr ? 'قائمة العملاء' : 'Clients List', path: '/clients' },
      { label: isAr ? 'إضافة عميل' : 'Add Client', path: '/clients/add' },
    ]},
    { icon: '➕', label: isAr ? 'اشتراك جديد' : 'New Subscription', path: '/new-subscription' },
    { icon: '📋', label: isAr ? 'الاشتراكات' : 'Subscriptions', path: '/subscriptions' },
    { icon: '📦', label: isAr ? 'الباقات' : 'Packages', path: '/packages', sub: [
      { label: isAr ? 'قائمة الباقات' : 'Packages List', path: '/packages' },
      { label: isAr ? 'التصنيفات' : 'Categories', path: '/categories' },
    ]},
    { icon: '🍽', label: isAr ? 'الوجبات' : 'Meals', path: '/meals' },
    { icon: '🏷', label: isAr ? 'طباعة الملصقات' : 'Print Labels', path: '/labels' },
    { icon: '📅', label: isAr ? 'اعدادات المنيو' : 'Menu Settings', path: '/menu-settings' },
    { icon: '✅', label: isAr ? 'وجبات العميل' : 'Client Meals', path: '/client-meals' },
    { icon: '🚗', label: isAr ? 'التوصيل' : 'Delivery', path: '/delivery' },
    { icon: '🗺', label: isAr ? 'المناطق' : 'Regions', path: '/regions' },
    { icon: '💰', label: isAr ? 'التقارير المالية' : 'Financial Reports', path: '/reports' },
    { icon: '🏭', label: isAr ? 'تقرير التصنيع' : 'Manufacturing Report', path: '/manufacturing-report' },
    { icon: '🏷️', label: isAr ? 'ملصقات الوجبات' : 'Meal Labels', path: '/meal-labels' },
    { icon: '🤖', label: isAr ? 'الاختيار التلقائي' : 'Auto-Select', path: '/auto-select' },
    { icon: '💰', label: isAr ? 'إعدادات الأسعار' : 'Pricing Settings', path: '/pricing' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>Diet Plan</h1>
        <span>{isAr ? 'لوحة التحكم' : 'Dashboard'}</span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">{isAr ? 'القائمة الرئيسية' : 'Main Menu'}</div>
        {navItems.map(item => (
          <div key={item.path}>
            <Link
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
            {item.sub && item.sub.map(sub => (
              <Link
                key={sub.path}
                to={sub.path}
                className={`nav-item ${location.pathname === sub.path ? 'active' : ''}`}
                style={{ paddingRight: isAr ? '52px' : '16px', paddingLeft: isAr ? '16px' : '52px', fontSize: '0.82rem' }}
              >
                {sub.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Language Toggle */}
      <div style={{ padding: '16px', borderTop: '1px solid #1e293b' }}>
        <button
          onClick={toggleLang}
          style={{
            width: '100%', padding: '10px', borderRadius: '8px',
            background: '#1e293b', border: '1px solid #334155',
            color: '#94a3b8', cursor: 'pointer', fontFamily: 'var(--font-main)',
            fontSize: '0.85rem', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '8px', transition: 'all 0.2s',
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#0d9488'; e.currentTarget.style.color = 'white'; }}
          onMouseOut={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          <span style={{ fontSize: '1.1rem' }}>🌐</span>
          {isAr ? 'Switch to English' : 'التبديل للعربية'}
        </button>
        <div style={{ color: '#334155', fontSize: '0.72rem', textAlign: 'center', marginTop: '8px' }}>
          {isAr ? 'نظام ادارة الوجبات الصحية' : 'Diet Plan Management System'}
        </div>
      </div>
    </aside>
  );
}
