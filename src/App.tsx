import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DealsProvider } from './context/DealsContext';
import LoginPage from './pages/LoginPage';
import DealsListPage from './pages/DealsListPage';
import AddDealPage from './pages/AddDealPage';
import DealDetailPage from './pages/DealDetailPage';
import EditDealPage from './pages/EditDealPage';
import UserManagementPage from './pages/UserManagementPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role !== 'Superadmin') return <Navigate to="/deals" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { currentUser } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/deals" replace /> : <LoginPage />} />
      <Route path="/deals" element={<ProtectedRoute><DealsListPage /></ProtectedRoute>} />
      <Route path="/deals/new" element={<ProtectedRoute><AddDealPage /></ProtectedRoute>} />
      <Route path="/deals/:id" element={<ProtectedRoute><DealDetailPage /></ProtectedRoute>} />
      <Route path="/deals/:id/edit" element={<ProtectedRoute><EditDealPage /></ProtectedRoute>} />
      <Route path="/users" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
      <Route path="*" element={<Navigate to={currentUser ? "/deals" : "/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DealsProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 5000,
              style: {
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '8px',
                padding: '12px 16px',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
              },
              success: {
                style: { background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' },
                iconTheme: { primary: '#16A34A', secondary: '#fff' },
              },
              error: {
                style: { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' },
                iconTheme: { primary: '#DC2626', secondary: '#fff' },
              },
            }}
          />
        </BrowserRouter>
      </DealsProvider>
    </AuthProvider>
  );
}
