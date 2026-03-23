import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import AddClient from './pages/AddClient';
import ManufacturingReport from './pages/ManufacturingReport';
import ClientsList from './pages/ClientsList';
import ClientProfile from './pages/ClientProfile';
import LabelsPage from './pages/LabelsPage';
import MenuSettings from './pages/MenuSettings';
import ClientMeals from './pages/ClientMeals';
import NewSubscription from './pages/NewSubscription';
import SubscriptionsPage from './pages/SubscriptionsPage';
import CategoriesPage from './pages/CategoriesPage';
import PackagesPage from './pages/PackagesPage';
import DeliveryPage from './pages/DeliveryPage';
import MealLabels from './pages/MealLabels';
import AutoSelectPage from './pages/AutoSelectPage';
import PricingSettings from './pages/PricingSettings';
import { checkAndRunScheduled } from './firebase/autoSelectService';
import './styles/main.css';

function Placeholder({ title }) {
  return (
    <div>
      <div className="page-header">
        <h2>{title}</h2>
      </div>
      <div className="page-body">
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-icon">🚧</div>
              <h3>قيد التطوير</h3>
              <p>هذا القسم سيكون متاحاً قريباً</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    checkAndRunScheduled().then(result => {
      if (result) console.log('Auto-select ran:', result);
    });
  }, []);

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<ClientsList />} />
            <Route path="/clients/add" element={<AddClient />} />
            <Route path="/clients/:clientId" element={<ClientProfile />} />
            <Route path="/new-subscription" element={<NewSubscription />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/packages" element={<PackagesPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/labels" element={<LabelsPage />} />
            <Route path="/menu-settings" element={<MenuSettings />} />
            <Route path="/client-meals" element={<ClientMeals />} />
            <Route path="/delivery" element={<DeliveryPage />} />
            <Route path="/meal-labels" element={<MealLabels />} />
            <Route path="/manufacturing-report" element={<ManufacturingReport />} />
            <Route path="/auto-select" element={<AutoSelectPage />} />
            <Route path="/pricing" element={<PricingSettings />} />
            <Route path="/meals" element={<Placeholder title="الوجبات" />} />
            <Route path="/reports" element={<Placeholder title="التقارير المالية" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
