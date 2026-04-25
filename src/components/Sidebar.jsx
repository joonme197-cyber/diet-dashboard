import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../LanguageContext';
import { useAuth } from '../AuthContext';

export default function Sidebar() {
  const location = useLocation();
  const { lang, toggleLang } = useLang();
  const { userData, logout, isSuperAdmin } = useAuth();
  const isAr = lang === 'ar';

  const [openMenus, setOpenMenus] = useState({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMenu = (key) => setOpenMenus(p => ({ ...p, [key]: !p[key] }));

  // إغلاق السايدبار عند تغيير الصفحة (موبايل)
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  // منع سكرول الخلفية لما السايدبار مفتوح
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const navItems = [
    { icon: '🏠', label: isAr ? 'الرئيسية'         : 'Home',              path: '/' },

    { icon: '👥', label: isAr ? 'العملاء'           : 'Clients',           key: 'clients', sub: [
      { label: isAr ? 'قائمة العملاء' : 'Clients List', path: '/clients'     },
      { label: isAr ? 'إضافة عميل'   : 'Add Client',    path: '/clients/add' },
    ]},

    { icon: '📋', label: isAr ? 'الاشتراكات'   : 'Subscriptions',    path: '/subscriptions',    perm: 'subscriptions.view' },
    { icon: '➕', label: isAr ? 'اشتراك جديد'  : 'New Subscription', path: '/new-subscription', perm: 'subscriptions.add'  },

    { icon: '📦', label: isAr ? 'الباقات'           : 'Packages',          key: 'packages', sub: [
      { label: isAr ? 'باقات ثابتة'         : 'Fixed Packages',       path: '/packages?type=normal'   },
      { label: isAr ? 'باقات مرنة'          : 'Flex Packages',        path: '/packages?type=flex'     },
      { label: isAr ? 'تصنيفات الباقات'     : 'Package Categories',   path: '/categories'             },
      { label: isAr ? 'إعدادات الأسعار'     : 'Pricing Settings',     path: '/pricing'                },
    ]},

    { icon: '📅', label: isAr ? 'المنيو'            : 'Menu',              key: 'menu', sub: [
      { label: isAr ? 'تصنيفات الوجبات'    : 'Meal Categories',  path: '/meal-categories'         },
      { label: isAr ? 'الوجبات'            : 'Meals',            path: '/meals'                   },
      { label: isAr ? 'المنيو الأساسي'     : 'Default Menu',     path: '/menu-settings'           },
      { label: isAr ? 'منيو الشيف'         : 'Chef Menu',        path: '/menu-settings?type=chef' },
      { label: isAr ? 'السلايدر والبانرات'  : 'Slider & Banners', path: '/slides'                  },
    ]},

    { icon: '🏭', label: isAr ? 'تقارير الإنتاج'   : 'Production',        key: 'production', sub: [
      { label: isAr ? 'وجبات العميل'   : 'Client Meals',         path: '/client-meals'         },
      { label: isAr ? 'تقرير التصنيع'  : 'Manufacturing Report', path: '/manufacturing-report' },
      { label: isAr ? 'تقرير التعبئة'  : 'Kitchen Fill Report',  path: '/kitchen-fill-report'  },
      { label: isAr ? 'ملصقات البوكسات': 'Box Labels',           path: '/labels'               },
      { label: isAr ? 'ملصقات الوجبات' : 'Meal Labels',          path: '/meal-labels'          },
    ]},

    { icon: '🚗', label: isAr ? 'التوصيل'           : 'Delivery',          key: 'delivery', sub: [
      { label: isAr ? 'المناطق'          : 'Regions',          path: '/regions'                    },
      { label: isAr ? 'إدارة التوصيل'   : 'Management',       path: '/delivery'                   },
      { label: isAr ? 'تقرير التوصيل'   : 'Delivery Report',  path: '/delivery-report'            },
      { label: isAr ? 'تقرير بالسائقين' : 'By Drivers',       path: '/delivery-report?by=drivers' },
      { label: isAr ? 'تقرير بالمناطق'  : 'By Regions',       path: '/delivery-report?by=regions' },
      { label: isAr ? 'فترات التوصيل'    : 'Delivery Periods', path: '/delivery-periods'           },
    ]},

    { icon: '💰', label: isAr ? 'التقارير المالية'  : 'Financial Reports', key: 'financial', sub: [
      { label: isAr ? 'التقارير المالية'  : 'Financial Reports', path: '/reports'        },
      { label: isAr ? 'كوبونات الخصم'    : 'Discount Coupons',  path: '/coupons'        },
      { label: isAr ? 'تقرير الكوبونات'  : 'Coupon Report',     path: '/coupon-report'  },
    ]},
    { icon: '💹', label: isAr ? 'المالية والعمليات' : 'Finance & Ops',     key: 'finance', sub: [
      { label: isAr ? 'لوحة المالية'    : 'Finance Dashboard', path: '/finance'    },
      { label: isAr ? 'المخزون'         : 'Inventory',         path: '/inventory'  },
      { label: isAr ? 'الموردون'        : 'Suppliers',         path: '/suppliers'  },
      { label: isAr ? 'المشتريات'       : 'Purchases',         path: '/purchases'  },
      { label: isAr ? 'الوصفات والتكاليف': 'Recipes & Costs',   path: '/recipes'    },
      { label: isAr ? 'المصروفات'       : 'Expenses',          path: '/expenses'   },
    ]},

    { icon: '🤖', label: isAr ? 'التشغيل التلقائي'  : 'Auto-Select',       path: '/auto-select' },

    // إدارة المستخدمين + الإعدادات — Super Admin فقط
    ...(isSuperAdmin ? [
      { icon: '🔑', label: isAr ? 'إدارة المستخدمين' : 'Users Management', path: '/users' },
      { icon: '⚙️', label: isAr ? 'إعدادات التطبيق'  : 'App Settings',     path: '/app-settings' },
    ] : []),
  ];

  const isSubActive = (sub) =>
    sub?.some(s => (location.pathname + location.search) === s.path || location.pathname === s.path.split('?')[0]);

  return (
    <>
      {/* زر الهامبرغر — يظهر فقط على الموبايل والتابلت */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(true)}
        aria-label="فتح القائمة"
      >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>

      {/* الأوفرلاي */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        {/* زر إغلاق للموبايل */}
        <button
          className="sidebar-close-btn"
          onClick={() => setMobileOpen(false)}
          aria-label="إغلاق القائمة"
        >
          ✕
        </button>

        <div className="sidebar-logo">
          <h1>Diet Plan</h1>
          <span>{isAr ? 'لوحة التحكم' : 'Dashboard'}</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">{isAr ? 'القائمة الرئيسية' : 'Main Menu'}</div>

          {navItems.map((item) => {
            const hasKey  = !!item.key;
            const isOpen  = !!openMenus[item.key];
            const subAct  = isSubActive(item.sub);
            const isActive = !hasKey && location.pathname === item.path;

            return (
              <div key={item.key || item.path}>
                {hasKey ? (
                  <button onClick={() => toggleMenu(item.key)} style={{
                    width: '100%', background: subAct ? '#0d2535' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '11px 24px', fontFamily: 'var(--font-main)',
                    fontSize: '0.88rem', fontWeight: 600,
                    textAlign: isAr ? 'right' : 'left',
                    color: subAct || isOpen ? '#14b8a6' : '#94a3b8',
                    borderRight: isAr ? `3px solid ${subAct ? '#14b8a6' : 'transparent'}` : 'none',
                    borderLeft:  !isAr ? `3px solid ${subAct ? '#14b8a6' : 'transparent'}` : 'none',
                    transition: 'all 0.2s',
                  }}>
                    <span style={{ fontSize: '1.1rem', width: '20px', textAlign: 'center' }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <span style={{
                      fontSize: '0.65rem', color: '#475569',
                      transition: 'transform 0.25s',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block',
                    }}>▼</span>
                  </button>
                ) : (
                  <Link to={item.path} className={`nav-item ${isActive ? 'active' : ''}`}>
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                  </Link>
                )}

                {hasKey && isOpen && (
                  <div style={{ borderBottom: '1px solid #1e293b', marginBottom: '2px' }}>
                    {item.sub.map(sub => (
                      <Link key={sub.path} to={sub.path}
                        className={`nav-item ${location.pathname === sub.path.split('?')[0] ? 'active' : ''}`}
                        style={{
                          paddingRight: isAr ? '44px' : '16px',
                          paddingLeft:  isAr ? '16px' : '44px',
                          paddingTop: '8px', paddingBottom: '8px',
                          fontSize: '0.8rem',
                          borderRight: isAr ? '2px solid #1e4a5f' : 'none',
                          borderLeft:  !isAr ? '2px solid #1e4a5f' : 'none',
                          marginRight: isAr ? '10px' : '0',
                          marginLeft:  !isAr ? '10px' : '0',
                        }}>
                        <span style={{ color: '#0d9488', marginRight: isAr ? '6px' : '0', marginLeft: !isAr ? '6px' : '0' }}>›</span>
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* معلومات المستخدم + تسجيل الخروج */}
        {userData && (
          <div style={{ padding:'12px 16px', borderTop:'1px solid #1e293b' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
              <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#0d9488', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0, fontWeight:700, color:'white' }}>
                {userData.name?.charAt(0) || '👤'}
              </div>
              <div style={{ flex:1, overflow:'hidden' }}>
                <div style={{ color:'#e2e8f0', fontWeight:700, fontSize:'0.82rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {userData.name}
                </div>
                <div style={{ color:'#475569', fontSize:'0.7rem' }}>
                  {userData.role === 'super_admin' ? (isAr?'مدير عام':'Super Admin') :
                   userData.role === 'manager'     ? (isAr?'مدير':'Manager') :
                   userData.role === 'kitchen'     ? (isAr?'موظف مطبخ':'Kitchen') :
                   userData.role === 'delivery'    ? (isAr?'توصيل':'Delivery') :
                   userData.role === 'accountant'  ? (isAr?'محاسب':'Accountant') :
                   (isAr?'مشاهد':'Viewer')}
                </div>
              </div>
            </div>
            <button onClick={logout}
              style={{
                width:'100%', padding:'8px', borderRadius:'8px',
                background:'#1e293b', border:'1px solid #334155',
                color:'#f87171', cursor:'pointer', fontFamily:'var(--font-main)',
                fontSize:'0.82rem', display:'flex', alignItems:'center',
                justifyContent:'center', gap:'8px', transition:'all 0.2s', fontWeight:600,
              }}
              onMouseOver={e => { e.currentTarget.style.background='#ef4444'; e.currentTarget.style.color='white'; e.currentTarget.style.borderColor='#ef4444'; }}
              onMouseOut={e => { e.currentTarget.style.background='#1e293b'; e.currentTarget.style.color='#f87171'; e.currentTarget.style.borderColor='#334155'; }}
            >
              🚪 {isAr?'تسجيل الخروج':'Logout'}
            </button>
          </div>
        )}

        {/* Language Toggle */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b' }}>
          <button onClick={toggleLang} style={{
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
    </>
  );
}
