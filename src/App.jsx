import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import { checkAndRunScheduled } from './firebase/autoSelectService';
import './styles/main.css';

// ── Lazy Loading لكل الصفحات ──
const Dashboard          = lazy(() => import('./pages/Dashboard'));
const AddClient          = lazy(() => import('./pages/AddClient'));
const ManufacturingReport= lazy(() => import('./pages/ManufacturingReport'));
const ClientsList        = lazy(() => import('./pages/ClientsList'));
const ClientProfile      = lazy(() => import('./pages/ClientProfile'));
const LabelsPage         = lazy(() => import('./pages/LabelsPage'));
const MenuSettings       = lazy(() => import('./pages/MenuSettings'));
const ClientMeals        = lazy(() => import('./pages/ClientMeals'));
const NewSubscription    = lazy(() => import('./pages/NewSubscription'));
const SubscriptionsPage  = lazy(() => import('./pages/SubscriptionsPage'));
const CategoriesPage     = lazy(() => import('./pages/CategoriesPage'));
const PackagesPage       = lazy(() => import('./pages/PackagesPage'));
const DeliveryPage       = lazy(() => import('./pages/DeliveryPage'));
const MealLabels         = lazy(() => import('./pages/MealLabels'));
const AutoSelectPage     = lazy(() => import('./pages/AutoSelectPage'));
const PricingSettings    = lazy(() => import('./pages/PricingSettings'));
const KitchenFillReport  = lazy(() => import('./pages/KitchenFillReport'));
const RegionsPage        = lazy(() => import('./pages/RegionsPage'));
const DeliveryReport     = lazy(() => import('./pages/DeliveryReport'));
const MealsPage          = lazy(() => import('./pages/MealsPage'));
const UsersPage          = lazy(() => import('./pages/UsersPage'));
const CouponsPage        = lazy(() => import('./pages/CouponsPage'));
const CouponReport       = lazy(() => import('./pages/CouponReport'));
const SlidesPage         = lazy(() => import('./pages/SlidesPage'));
const MealCategoriesPage = lazy(() => import('./pages/MealCategoriesPage'));
const DeliveryPeriodsPage= lazy(() => import('./pages/DeliveryPeriodsPage'));
const AppSettingsPage    = lazy(() => import('./pages/AppSettingsPage'));
const FinanceDashboard   = lazy(() => import('./pages/FinanceDashboard'));
const InventoryPage      = lazy(() => import('./pages/InventoryPage'));
const SuppliersPage      = lazy(() => import('./pages/SuppliersPage'));
const PurchasesPage      = lazy(() => import('./pages/PurchasesPage'));
const RecipesPage        = lazy(() => import('./pages/RecipesPage'));
const ExpensesPage       = lazy(() => import('./pages/ExpensesPage'));

// ── Loading Fallback ──
const PageLoader = () => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
    <div style={{ textAlign:'center' }}>
      <div className="spinner" style={{ width:'28px', height:'28px', borderWidth:'3px', margin:'0 auto 10px' }} />
      <div style={{ color:'#64748b', fontSize:'0.85rem' }}>جاري التحميل...</div>
    </div>
  </div>
);

// ── مكون لحماية الـ Routes ──
function ProtectedRoute({ children, perm }) {
  const { can, isSuperAdmin } = useAuth();
  if (isSuperAdmin || !perm || can(perm)) return children;
  return (
    <div>
      <div className="page-header"><h2>🔒 غير مصرح</h2></div>
      <div className="page-body">
        <div className="card"><div className="card-body">
          <div className="empty-state">
            <div className="empty-icon">🔒</div>
            <h3>ليس لديك صلاحية لعرض هذه الصفحة</h3>
            <p>تواصل مع المدير لمنحك الصلاحية</p>
          </div>
        </div></div>
      </div>
    </div>
  );
}

function Placeholder({ title }) {
  return (
    <div>
      <div className="page-header"><h2>{title}</h2></div>
      <div className="page-body">
        <div className="card"><div className="card-body">
          <div className="empty-state">
            <div className="empty-icon">🚧</div>
            <h3>قيد التطوير</h3>
          </div>
        </div></div>
      </div>
    </div>
  );
}

function AppLayout() {
  const { user, userData, loading, logout } = useAuth();

  useEffect(() => {
    if (user) {
      checkAndRunScheduled().then(result => {
        if (result) console.log('Auto-select ran:', result);
      });
    }
  }, [user]);

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8fafc' }}>
        <div style={{ textAlign:'center' }}>
          <div className="spinner" style={{ width:'32px', height:'32px', borderWidth:'3px', margin:'0 auto 12px' }} />
          <div style={{ color:'#64748b', fontSize:'0.9rem' }}>جاري التحميل...</div>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  if (userData?.isActive === false) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8fafc', fontFamily:"'Cairo',sans-serif" }}>
        <div style={{ textAlign:'center', padding:'40px' }}>
          <div style={{ fontSize:'4rem', marginBottom:'16px' }}>🔒</div>
          <h2 style={{ color:'#dc2626', marginBottom:'8px' }}>حسابك معطّل</h2>
          <p style={{ color:'#64748b', marginBottom:'24px' }}>تواصل مع المدير لتفعيل حسابك</p>
          <button onClick={logout} style={{ background:'#0d9488', color:'white', border:'none', borderRadius:'8px', padding:'10px 24px', cursor:'pointer', fontFamily:"'Cairo',sans-serif", fontSize:'0.9rem' }}>
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients"           element={<ProtectedRoute perm="clients.view"><ClientsList /></ProtectedRoute>} />
            <Route path="/clients/add"       element={<ProtectedRoute perm="clients.add"><AddClient /></ProtectedRoute>} />
            <Route path="/clients/:clientId" element={<ProtectedRoute perm="clients.view"><ClientProfile /></ProtectedRoute>} />
            <Route path="/new-subscription"  element={<ProtectedRoute perm="subscriptions.add"><NewSubscription /></ProtectedRoute>} />
            <Route path="/subscriptions"     element={<ProtectedRoute perm="subscriptions.view"><SubscriptionsPage /></ProtectedRoute>} />
            <Route path="/packages"          element={<ProtectedRoute perm="packages.view"><PackagesPage /></ProtectedRoute>} />
            <Route path="/categories"        element={<ProtectedRoute perm="packages.view"><CategoriesPage /></ProtectedRoute>} />
            <Route path="/pricing"           element={<ProtectedRoute perm="packages.edit"><PricingSettings /></ProtectedRoute>} />
            <Route path="/meals"             element={<ProtectedRoute perm="meals.view"><MealsPage /></ProtectedRoute>} />
            <Route path="/meal-categories"   element={<ProtectedRoute perm="meals.view"><MealCategoriesPage /></ProtectedRoute>} />
            <Route path="/delivery-periods"   element={<ProtectedRoute perm="delivery.edit"><DeliveryPeriodsPage /></ProtectedRoute>} />
            <Route path="/menu-settings"     element={<ProtectedRoute perm="menu.view"><MenuSettings /></ProtectedRoute>} />
            <Route path="/labels"            element={<ProtectedRoute perm="labels.print"><LabelsPage /></ProtectedRoute>} />
            <Route path="/meal-labels"       element={<ProtectedRoute perm="labels.print"><MealLabels /></ProtectedRoute>} />
            <Route path="/client-meals"      element={<ProtectedRoute perm="reports.production"><ClientMeals /></ProtectedRoute>} />
            <Route path="/manufacturing-report" element={<ProtectedRoute perm="reports.production"><ManufacturingReport /></ProtectedRoute>} />
            <Route path="/kitchen-fill-report"  element={<ProtectedRoute perm="reports.production"><KitchenFillReport /></ProtectedRoute>} />
            <Route path="/delivery"          element={<ProtectedRoute perm="delivery.edit"><DeliveryPage /></ProtectedRoute>} />
            <Route path="/regions"           element={<ProtectedRoute perm="delivery.edit"><RegionsPage /></ProtectedRoute>} />
            <Route path="/delivery-report"   element={<ProtectedRoute perm="reports.delivery"><DeliveryReport /></ProtectedRoute>} />
            <Route path="/reports"           element={<ProtectedRoute perm="reports.financial"><Placeholder title="التقارير المالية" /></ProtectedRoute>} />
            <Route path="/coupons"           element={<ProtectedRoute perm="reports.financial"><CouponsPage /></ProtectedRoute>} />
            <Route path="/coupon-report"     element={<ProtectedRoute perm="reports.financial"><CouponReport /></ProtectedRoute>} />
            <Route path="/slides"            element={<ProtectedRoute perm="menu.view"><SlidesPage /></ProtectedRoute>} />
            <Route path="/auto-select"       element={<ProtectedRoute perm="auto.view"><AutoSelectPage /></ProtectedRoute>} />
            <Route path="/users"             element={<ProtectedRoute perm="users.manage"><UsersPage /></ProtectedRoute>} />
            <Route path="/app-settings"      element={<ProtectedRoute perm="users.manage"><AppSettingsPage /></ProtectedRoute>} />
            <Route path="/finance"           element={<ProtectedRoute perm="reports.financial"><FinanceDashboard /></ProtectedRoute>} />
            <Route path="/inventory"         element={<ProtectedRoute perm="reports.financial"><InventoryPage /></ProtectedRoute>} />
            <Route path="/suppliers"         element={<ProtectedRoute perm="reports.financial"><SuppliersPage /></ProtectedRoute>} />
            <Route path="/purchases"         element={<ProtectedRoute perm="reports.financial"><PurchasesPage /></ProtectedRoute>} />
            <Route path="/recipes"           element={<ProtectedRoute perm="reports.financial"><RecipesPage /></ProtectedRoute>} />
            <Route path="/expenses"          element={<ProtectedRoute perm="reports.financial"><ExpensesPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}
