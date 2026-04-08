import { BrowserRouter, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { InstituteProvider, useInstitute } from './context/InstituteContext';

// Pages
import LandingPage from './pages/LandingPage';
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
import LectureLiveJoinPage from './pages/LectureLiveJoinPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminStudents from './pages/admin/AdminStudents';
import AdminClasses from './pages/admin/AdminClasses';
import AdminClassDetail from './pages/admin/AdminClassDetail';
import AdminSlips from './pages/admin/AdminSlips';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminRecordingHistory from './pages/admin/AdminRecordingHistory';
import AdminStudentWatchDetail from './pages/admin/AdminStudentWatchDetail';
import AdminClassAttendance from './pages/admin/AdminClassAttendance';
import AdminMonthRecAttendance from './pages/admin/AdminMonthRecAttendance';
import AdminMonthManage from './pages/admin/AdminMonthManage';
import AdminIdCards from './pages/admin/AdminIdCards';
import AdminInstitute from './pages/admin/AdminInstitute';
import AdminInstituteSelect from './pages/admin/AdminInstituteSelect';
import ClassMonthRecordingsPage from './pages/ClassMonthRecordingsPage';
import ClassMonthLiveLessonsPage from './pages/ClassMonthLiveLessonsPage';
import StudentMonthRecAttendance from './pages/StudentMonthRecAttendance';
import MyClassAttendancePage from './pages/MyClassAttendancePage';

import Layout from './components/Layout';
import { getInstituteAdminPath } from './lib/instituteRoutes';

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

function LoginRoute() {
  const { user } = useAuth();
  const { selected, loading: instituteLoading } = useInstitute();
  const [searchParams] = useSearchParams();
  if (user?.role === 'ADMIN' && instituteLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  if (user) {
    const redirect = searchParams.get('redirect');
    if (user.role === 'ADMIN') {
      if (selected) {
        return <Navigate to={redirect && redirect.startsWith('/') ? redirect : getInstituteAdminPath(selected.id)} />;
      }
      const target = redirect && redirect.startsWith('/')
        ? `/admin/select-institute?redirect=${encodeURIComponent(redirect)}`
        : '/admin/select-institute';
      return <Navigate to={target} />;
    }
    return <Navigate to={redirect && redirect.startsWith('/') ? redirect : '/dashboard'} />;
  }
  return <LoginPage />;
}

function AdminLegacyRedirect() {
  const { selected, loading } = useInstitute();
  const params = useParams();
  const suffix = params['*'] ? `/${params['*']}` : '';

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!selected) {
    const redirect = `/admin${suffix}`;
    return <Navigate to={`/admin/select-institute?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  return <Navigate to={getInstituteAdminPath(selected.id, suffix)} replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex justify-center items-center h-screen text-lg">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <RegisterPage />} />

      {/* Fullscreen recording player — outside Layout (ANYONE recordings work without login) */}
      <Route path="recording/:id" element={<RecordingPlayerPage />} />

      {/* Live lecture join — outside Layout */}
      <Route path="live/:token" element={<LiveJoinPage />} />
      <Route path="lecture-live/:token" element={<LectureLiveJoinPage />} />

      {/* Public landing page for non-logged-in users */}
      {!user && <Route path="/" element={<LandingPage />} />}

      <Route path="/" element={<Layout />}>
        <Route index element={<ClassesPage />} />
        <Route path="institute/:instituteId" element={<ClassesPage />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="institute/:instituteId/classes" element={<ClassesPage />} />
        <Route path="classes/:id" element={<ClassDetailPage />} />
        <Route path="institute/:instituteId/classes/:id" element={<ClassDetailPage />} />
        <Route path="classes/:id/class-recordings" element={<ClassDetailPage />} />
        <Route path="institute/:instituteId/classes/:id/class-recordings" element={<ClassDetailPage />} />
        <Route path="classes/:classId/months/:monthId" element={<ClassMonthRecordingsPage />} />
        <Route path="institute/:instituteId/classes/:classId/months/:monthId" element={<ClassMonthRecordingsPage />} />
        <Route path="classes/:classId/months/:monthId/rec-attendance" element={<ProtectedRoute role="ADMIN"><AdminMonthRecAttendance /></ProtectedRoute>} />
        <Route path="institute/:instituteId/classes/:classId/months/:monthId/rec-attendance" element={<ProtectedRoute role="ADMIN"><AdminMonthRecAttendance /></ProtectedRoute>} />
        <Route path="classes/:classId/months/:monthId/my-attendance" element={<ProtectedRoute><StudentMonthRecAttendance /></ProtectedRoute>} />
        <Route path="institute/:instituteId/classes/:classId/months/:monthId/my-attendance" element={<ProtectedRoute><StudentMonthRecAttendance /></ProtectedRoute>} />
        <Route path="classes/:classId/months/:monthId/live-lessons" element={<ProtectedRoute><ClassMonthLiveLessonsPage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/classes/:classId/months/:monthId/live-lessons" element={<ProtectedRoute><ClassMonthLiveLessonsPage /></ProtectedRoute>} />
        <Route path="dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="payments/submit" element={<ProtectedRoute><PaymentSubmitPage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/payments/submit" element={<ProtectedRoute><PaymentSubmitPage /></ProtectedRoute>} />
        <Route path="payments/my" element={<ProtectedRoute><MyPaymentsPage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/payments/my" element={<ProtectedRoute><MyPaymentsPage /></ProtectedRoute>} />
        <Route path="watch-history" element={<ProtectedRoute><WatchHistoryPage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/watch-history" element={<ProtectedRoute><WatchHistoryPage /></ProtectedRoute>} />
        <Route path="my-class-attendance" element={<ProtectedRoute role="STUDENT"><MyClassAttendancePage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/my-class-attendance" element={<ProtectedRoute role="STUDENT"><MyClassAttendancePage /></ProtectedRoute>} />

        <Route path="admin/select-institute" element={<ProtectedRoute role="ADMIN"><AdminInstituteSelect /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin" element={<ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/students" element={<ProtectedRoute role="ADMIN"><AdminStudents /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/classes" element={<ProtectedRoute role="ADMIN"><AdminClasses /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/classes/:id" element={<ProtectedRoute role="ADMIN"><AdminClassDetail /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/classes/:classId/months/:monthId/manage" element={<ProtectedRoute role="ADMIN"><AdminMonthManage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/slips" element={<ProtectedRoute role="ADMIN"><AdminSlips /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/attendance" element={<ProtectedRoute role="ADMIN"><AdminAttendance /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/class-attendance" element={<ProtectedRoute role="ADMIN"><AdminClassAttendance /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/recordings" element={<ProtectedRoute role="ADMIN"><AdminRecordingHistory /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/id-cards" element={<ProtectedRoute role="ADMIN"><AdminIdCards /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/institute" element={<ProtectedRoute role="ADMIN"><AdminInstitute /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/recordings/:recordingId/student/:userId" element={<ProtectedRoute role="ADMIN"><AdminStudentWatchDetail /></ProtectedRoute>} />
        <Route path="admin/*" element={<ProtectedRoute role="ADMIN"><AdminLegacyRedirect /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <InstituteProvider>
            <AppRoutes />
          </InstituteProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
