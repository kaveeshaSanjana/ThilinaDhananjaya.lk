import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminStudents from './pages/admin/AdminStudents';
import AdminClasses from './pages/admin/AdminClasses';
import AdminClassDetail from './pages/admin/AdminClassDetail';
import AdminSlips from './pages/admin/AdminSlips';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminRecordingHistory from './pages/admin/AdminRecordingHistory';

import Layout from './components/Layout';

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex justify-center items-center h-screen text-lg">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <RegisterPage />} />

      {/* Fullscreen recording player — outside Layout */}
      <Route path="recording/:id" element={<ProtectedRoute><RecordingPlayerPage /></ProtectedRoute>} />

      <Route path="/" element={<Layout />}>
        <Route index element={<ClassesPage />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="classes/:id" element={<ClassDetailPage />} />

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
        <Route path="admin/recordings" element={<ProtectedRoute role="ADMIN"><AdminRecordingHistory /></ProtectedRoute>} />
        <Route path="admin/recordings/:id/history" element={<ProtectedRoute role="ADMIN"><AdminRecordingHistory /></ProtectedRoute>} />
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
