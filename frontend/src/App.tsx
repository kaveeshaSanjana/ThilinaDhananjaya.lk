import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ClassesPage from './pages/ClassesPage';
import ClassDetailPage from './pages/ClassDetailPage';
import RecordingPlayerPage from './pages/RecordingPlayerPage';
import PaymentSubmitPage from './pages/PaymentSubmitPage';
import MyPaymentsPage from './pages/MyPaymentsPage';
import WatchHistoryPage from './pages/WatchHistoryPage';
import LiveJoinPage from './pages/LiveJoinPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminStudents from './pages/admin/AdminStudents';
import AdminClasses from './pages/admin/AdminClasses';
import AdminClassDetail from './pages/admin/AdminClassDetail';
import AdminSlips from './pages/admin/AdminSlips';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminRecordingHistory from './pages/admin/AdminRecordingHistory';
import AdminClassAttendance from './pages/admin/AdminClassAttendance';

import Layout from './components/Layout';

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

function LoginRoute() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  if (user) {
    const redirect = searchParams.get('redirect');
    return <Navigate to={redirect && redirect.startsWith('/') ? redirect : '/dashboard'} />;
  }
  return <LoginPage />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex justify-center items-center h-screen text-lg">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <RegisterPage />} />

      {/* Fullscreen recording player — outside Layout */}
      <Route path="recording/:id" element={<ProtectedRoute><RecordingPlayerPage /></ProtectedRoute>} />

      {/* Live lecture join — outside Layout */}
      <Route path="live/:token" element={<LiveJoinPage />} />

      <Route path="/" element={<Layout />}>
        <Route index element={<ClassesPage />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="classes/:id" element={<Navigate to="class-recordings" replace />} />
        <Route path="classes/:id/class-recordings" element={<ClassDetailPage />} />
        <Route path="dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="payments/submit" element={<ProtectedRoute><PaymentSubmitPage /></ProtectedRoute>} />
        <Route path="payments/my" element={<ProtectedRoute><MyPaymentsPage /></ProtectedRoute>} />
        <Route path="watch-history" element={<ProtectedRoute><WatchHistoryPage /></ProtectedRoute>} />

        <Route path="admin" element={<ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>} />
        <Route path="admin/students" element={<ProtectedRoute role="ADMIN"><AdminStudents /></ProtectedRoute>} />
        <Route path="admin/classes" element={<ProtectedRoute role="ADMIN"><AdminClasses /></ProtectedRoute>} />
        <Route path="admin/classes/:id" element={<ProtectedRoute role="ADMIN"><AdminClassDetail /></ProtectedRoute>} />
        <Route path="admin/slips" element={<ProtectedRoute role="ADMIN"><AdminSlips /></ProtectedRoute>} />
        <Route path="admin/attendance" element={<ProtectedRoute role="ADMIN"><AdminAttendance /></ProtectedRoute>} />
        <Route path="admin/class-attendance" element={<ProtectedRoute role="ADMIN"><AdminClassAttendance /></ProtectedRoute>} />
        <Route path="admin/recordings" element={<ProtectedRoute role="ADMIN"><AdminRecordingHistory /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
