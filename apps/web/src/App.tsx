import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { ROUTES } from '@/config/routes';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import OrdersPage from '@/pages/orders/OrdersPage';
import ArchivePage from '@/pages/orders/ArchivePage';
import WarehousePage from '@/pages/WarehousePage';
import ClientsPage from '@/pages/ClientsPage';
import ProductsPage from '@/pages/ProductsPage';
import StatisticsPage from '@/pages/StatisticsPage';
import SettingsPage from '@/pages/SettingsPage';
import AuditPage from '@/pages/AuditPage';
import Layout from './components/layout/Layout';
import ProductionCalcPage from '@/pages/ProductionCalcPage';

// Компоненти сторінок — відповідність path → компонент
const PAGE_COMPONENTS: Record<string, React.ReactNode> = {
  '/dashboard':  <DashboardPage />,
  '/orders':     <OrdersPage />,
  '/archive':    <ArchivePage />,
  '/warehouse':  <WarehousePage />,
  '/clients':    <ClientsPage />,
  '/products':   <ProductsPage />,
  '/statistics': <StatisticsPage />,
  '/settings':   <SettingsPage />,
  '/audit':      <AuditPage />,
  '/production-calc': <ProductionCalcPage />,
};

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function RoleRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: string[];
}) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />

        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />

          {ROUTES.map((route) => (
            <Route
              key={route.path}
              path={route.path.slice(1)} // прибираємо першу /
              element={
                <RoleRoute roles={route.roles}>
                  {PAGE_COMPONENTS[route.path]}
                </RoleRoute>
              }
            />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}