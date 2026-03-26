import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../LanguageContext';

export default function Sidebar() {
  const location = useLocation();
  const { lang, toggleLang, t } = useLang();
  const isAr = lang === 'ar';

  const navItems = [
    { icon: '🏠', label: isAr ? 'الرئيسية'          : 'Home',              path: '/' },

    { icon: '👥', label: isAr ? 'العملاء'            : 'Clients',           path: '/clients', sub: [
      { label: isAr ? 'قائمة العملاء' : 'Clients List', path: '/clients'     },
      { label: isAr ? 'إضافة عميل'   : 'Add Client',    path: '/clients/add' },
    ]},

    { icon: '📋', label: isAr ? 'الاشتراكات'         : 'Subscriptions',     path: '/subscriptions', sub: [
      { label: isAr ? 'اشتراك جديد'          : 'New Subscription', path: '/new-subscription'              },
      { label: isAr ? 'الاشتراكات الفعالة'   : 'Active',           path: '/subscriptions?status=active'   },
      { label: isAr ? 'الاشتراكات القادمة'   : 'Upcoming',         path: '/subscriptions?status=upcoming'  },
      { label: isAr ? 'قيد الانتهاء'         : 'Expiring Soon',    path: '/subscriptions?status=expiring'  },
      { label: isAr ? 'الاشتراكات المنتهية'  : 'Expired',          path: '/subscriptions?status=expired'   },
      { label: isAr ? 'الاشتراكات الملغية'   : 'Cancelled',        path: '/subscriptions?status=cancelled' },
    ]},

    { icon: '📦', label: isAr ? 'الباقات'            : 'Packages',          path: '/packages', sub: [
      { label: isAr ? 'باقات ثابتة'    : 'Fixed Packages',   path: '/packages?type=normal' },
      { label: isAr ? 'باقات مرنة'     : 'Flex Packages',    path: '/packages?type=flex'   },
      { label: isAr ? 'التصنيفات'      : 'Categories',       path: '/categories'            },
      { label: isAr ? 'إعدادات الأسعار': 'Pricing Settings', path: '/pricing'               },
    ]},

    { icon: '📅', label: isAr ? 'المنيو'             : 'Menu',              path: '/menu-settings', sub: [
      { label: isAr ? 'التصنيفات'       : 'Categories',     path: '/categories'    },
      { label: isAr ? 'الوجبات'         : 'Meals',          path: '/meals'         },
      { label: isAr ? 'المنيو الأساسي'  : 'Default Menu',   path: '/menu-settings' },
      { label: isAr ? 'منيو الشيف'      : 'Chef Menu',      path: '/menu-settings?type=chef' },
    ]},

    { icon: '✅', label: isAr ? 'وجبات العميل'       : 'Client Meals',      path: '/client-meals'  },

    { icon: '🚗', label: isAr ? 'التوصيل'            : 'Delivery',          path: '/delivery', sub: [
      { label: isAr ? 'المناطق'                  : 'Regions',                path: '/regions'                    },
      { label: isAr ? 'إدارة التوصيل'            : 'Delivery Management',    path: '/delivery'                   },
      { label: isAr ? 'تقرير التوصيل'            : 'Delivery Report',        path: '/delivery-report'            },
      { label: isAr ? 'تقرير التوصيل بالسائقين'  : 'Report by Drivers',      path: '/delivery-report?by=drivers' },
      { label: isAr ? 'تقرير التوصيل بالمناطق'   : 'Report by Regions',      path: '/delivery-report?by=regions' },
    ]},

    { icon: '💰', label: isAr ? 'التقارير المالية'   : 'Financial Reports', path: '/reports'       },
    { icon: '🤖', label: isAr ? 'الاختيار التلقائي'  : 'Auto-Select',       path: '/auto-select'   },

    { icon: '🏭', label: isAr ? 'تقارير الإنتاج'    : 'Production Reports', path: '/manufacturing-report', sub: [
      { label: isAr ? 'تقرير التصنيع'  : 'Manufacturing Report', path: '/manufacturing-report' },
      { label: isAr ? 'تقرير التعبئة'  : 'Kitchen Fill Report',  path: '/kitchen-fill-report'  },
      { label: isAr ? 'ملصقات البوكسات': 'Box Labels',           path: '/labels'               },
      { label: isAr ? 'ملصقات الوجبات' : 'Meal Labels',          path: '/meal-labels'          },
    ]},
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
                style={{
                  paddingRight: isAr ? '48px' : '16px',
                  paddingLeft:  isAr ? '16px' : '48px',
                  fontSize: '0.8rem',
                  borderRight: isAr ? '2px solid #0d9488' : 'none',
                  borderLeft:  isAr ? 'none' : '2px solid #0d9488',
                  marginRight: isAr ? '12px' : '0',
                  marginLeft:  isAr ? '0' : '12px',
                  opacity: 0.85,
                }}
              >
                <span style={{ marginLeft: isAr ? '0' : '6px', marginRight: isAr ? '6px' : '0', color: '#0d9488' }}>›</span>
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
