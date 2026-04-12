import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import LoginPage from '../../pages/LoginPage';
import DashboardPage from '../../pages/DashboardPage';
import RoutesPage from '../../pages/RoutesPage';
import DeliveryPage from '../../pages/DeliveryPage';
import SyncPage from '../../pages/SyncPage';
import FleetPage from '../../pages/FleetPage';
import AuditPage from '../../pages/AuditPage';
import InventoryPage from '../../pages/InventoryPage';
import Layout from '../layout/Layout';
import RoleGuard from '../auth/RoleGuard';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="routes" element={<RoutesPage />} />
        
        <Route
          path="deliveries"
          element={
            <ProtectedRoute allowedRoles={['volunteer', 'manager', 'commander', 'admin']}>
              <DeliveryPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="sync"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SyncPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="fleet"
          element={
            <ProtectedRoute allowedRoles={['drone_operator', 'commander', 'admin']}>
              <FleetPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="audit"
          element={
            <ProtectedRoute allowedRoles={['commander', 'admin']}>
              <AuditPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="inventory"
          element={
            <ProtectedRoute allowedRoles={['manager', 'commander', 'admin']}>
              <InventoryPage />
            </ProtectedRoute>
          }
        />
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
