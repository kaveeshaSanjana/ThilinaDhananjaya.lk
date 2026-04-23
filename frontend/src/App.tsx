import { BrowserRouter, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { InstituteProvider, useInstitute } from './context/InstituteContext';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClassesPage from './pages/ClassesPage';
import ClassDetailPage from './pages/ClassDetailPage';
import RecordingPlayerPage from './pages/RecordingPlayerPage';
import PaymentSubmitPage from './pages/PaymentSubmitPage';
import MyPaymentsPage from './pages/MyPaymentsPage';
import ClassMonthPaymentsPage from './pages/ClassMonthPaymentsPage';
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
import AdminMarkAttendance from './pages/admin/AdminMarkAttendance';
import AdminMarkAttendanceExternalDevice from './pages/admin/AdminMarkAttendanceExternalDevice';
import AdminPhysicalAttendanceView from './pages/admin/AdminPhysicalAttendanceView';
import AdminMonthRecAttendance from './pages/admin/AdminMonthRecAttendance';
import AdminMonthManage from './pages/admin/AdminMonthManage';
import AdminIdCards from './pages/admin/AdminIdCards';
import AdminInstitute from './pages/admin/AdminInstitute';
import AdminInstituteSelect from './pages/admin/AdminInstituteSelect';
import ClassMonthRecordingsPage from './pages/ClassMonthRecordingsPage';
import ClassMonthLiveLessonsPage from './pages/ClassMonthLiveLessonsPage';
import ClassMonthMediaPage from './pages/ClassMonthMediaPage';
import StudentMonthRecAttendance from './pages/StudentMonthRecAttendance';
import MyClassAttendancePage from './pages/MyClassAttendancePage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import StudentProfilePage from './pages/StudentProfilePage';
import MainLandingPage from './pages/MainLandingPage';

import Layout from './components/Layout';
import LandingStyleLoading from './components/LandingStyleLoading';
import { getInstituteAdminPath } from './lib/instituteRoutes';

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <LandingStyleLoading />;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

function LoginRoute() {
  const { user } = useAuth();
  const { selected, loading: instituteLoading } = useInstitute();
  const [searchParams] = useSearchParams();
  if (user?.role === 'ADMIN' && instituteLoading) {
    return <LandingStyleLoading />;
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
    return <LandingStyleLoading />;
  }

  if (!selected) {
    const redirect = `/admin${suffix}`;
    return <Navigate to={`/admin/select-institute?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  return <Navigate to={getInstituteAdminPath(selected.id, suffix)} replace />;
}

function MarkAttendanceExternalOnlyRedirect() {
  const { selected, loading } = useInstitute();
  const params = useParams<{ instituteId?: string; classId?: string }>();

  if (loading) {
    return <LandingStyleLoading />;
  }

  const instituteId = params.instituteId || selected?.id;
  const classId = params.classId;
  const baseTarget = getInstituteAdminPath(instituteId, '/mark-attendance/external-device');
  const target = classId ? `${baseTarget}?classId=${encodeURIComponent(classId)}` : baseTarget;

  return <Navigate to={target} replace />;
}

function LandingPageView() {
  const { user, loading } = useAuth();
  const { selected } = useInstitute();

  if (loading) {
    return <LandingStyleLoading />;
  }

  // If user is authenticated, redirect to appropriate dashboard
  if (user) {
    if (user.role === 'ADMIN' && selected) {
      return <Navigate to={getInstituteAdminPath(selected.id)} replace />;
    }
    if (user.role === 'STUDENT') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // For unauthenticated users, render the landing content directly in the same app.
  return <MainLandingPage />;
}

function AppRoutes() {
  const { loading } = useAuth();

  if (loading) return <LandingStyleLoading />;

  return (
    <Routes>
      {/* Serve static landing page HTML - outside Layout to avoid routing conflicts */}
      <Route path="/landing-page.html" element={<div />} />
      <Route path="/" element={<LandingPageView />} />
      
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/landing" element={<Navigate to="/" replace />} />
      <Route path="/landing-site" element={<Navigate to="/" replace />} />
      <Route path="/landing-site/*" element={<Navigate to="/" replace />} />

      {/* Fullscreen recording player — outside Layout (ANYONE recordings work without login) */}
      <Route path="recording/:id" element={<RecordingPlayerPage />} />

      {/* Live lecture join — outside Layout */}
      <Route path="live/:token" element={<LiveJoinPage />} />
      <Route path="lecture-live/:token" element={<LectureLiveJoinPage />} />

      <Route path="/" element={<Layout />}>
        <Route index element={<LandingPage />} />
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
        <Route path="classes/:classId/months/:monthId/media" element={<ClassMonthMediaPage />} />
        <Route path="institute/:instituteId/classes/:classId/months/:monthId/media" element={<ClassMonthMediaPage />} />
        <Route path="classes/:classId/months/:monthId/class-payments" element={<ProtectedRoute><ClassMonthPaymentsPage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/classes/:classId/months/:monthId/class-payments" element={<ProtectedRoute><ClassMonthPaymentsPage /></ProtectedRoute>} />
        <Route path="classes/:classId/physical-attendance" element={<ProtectedRoute role="ADMIN"><MarkAttendanceExternalOnlyRedirect /></ProtectedRoute>} />
        <Route path="institute/:instituteId/classes/:classId/physical-attendance" element={<ProtectedRoute role="ADMIN"><MarkAttendanceExternalOnlyRedirect /></ProtectedRoute>} />
        <Route path="classes/:classId/physical-attendance/qr" element={<ProtectedRoute role="ADMIN"><MarkAttendanceExternalOnlyRedirect /></ProtectedRoute>} />
        <Route path="institute/:instituteId/classes/:classId/physical-attendance/qr" element={<ProtectedRoute role="ADMIN"><MarkAttendanceExternalOnlyRedirect /></ProtectedRoute>} />
        <Route path="dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="payments/submit" element={<ProtectedRoute><PaymentSubmitPage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/payments/submit" element={<ProtectedRoute><PaymentSubmitPage /></ProtectedRoute>} />
        <Route path="payments/my" element={<ProtectedRoute><MyPaymentsPage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/payments/my" element={<ProtectedRoute><MyPaymentsPage /></ProtectedRoute>} />
        <Route path="class-payments" element={<ProtectedRoute><ClassMonthPaymentsPage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/class-payments" element={<ProtectedRoute><ClassMonthPaymentsPage /></ProtectedRoute>} />
        <Route path="watch-history" element={<ProtectedRoute><WatchHistoryPage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/watch-history" element={<ProtectedRoute><WatchHistoryPage /></ProtectedRoute>} />
        <Route path="my-class-attendance" element={<ProtectedRoute role="STUDENT"><MyClassAttendancePage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/my-class-attendance" element={<ProtectedRoute role="STUDENT"><MyClassAttendancePage /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute role="STUDENT"><StudentProfilePage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/profile" element={<ProtectedRoute role="STUDENT"><StudentProfilePage /></ProtectedRoute>} />
        <Route path="change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />

        <Route path="admin/select-institute" element={<ProtectedRoute role="ADMIN"><AdminInstituteSelect /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin" element={<ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/students" element={<ProtectedRoute role="ADMIN"><AdminStudents /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/classes" element={<ProtectedRoute role="ADMIN"><AdminClasses /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/classes/:id" element={<ProtectedRoute role="ADMIN"><AdminClassDetail /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/classes/:classId/months/:monthId/manage" element={<ProtectedRoute role="ADMIN"><AdminMonthManage /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/classes/:classId/months/:monthId/rec-attendance" element={<ProtectedRoute role="ADMIN"><AdminMonthRecAttendance /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/slips" element={<ProtectedRoute role="ADMIN"><AdminSlips /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/attendance" element={<ProtectedRoute role="ADMIN"><AdminAttendance /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/mark-attendance" element={<ProtectedRoute role="ADMIN"><AdminMarkAttendance /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/mark-attendance/external-device" element={<ProtectedRoute role="ADMIN"><AdminMarkAttendanceExternalDevice /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/class-attendance" element={<ProtectedRoute role="ADMIN"><AdminPhysicalAttendanceView /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/recordings" element={<ProtectedRoute role="ADMIN"><AdminRecordingHistory /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/id-cards" element={<ProtectedRoute role="ADMIN"><AdminIdCards /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/institute" element={<ProtectedRoute role="ADMIN"><AdminInstitute /></ProtectedRoute>} />
        <Route path="institute/:instituteId/admin/recordings/:recordingId/student/:userId" element={<ProtectedRoute role="ADMIN"><AdminStudentWatchDetail /></ProtectedRoute>} />
        <Route path="admin/*" element={<ProtectedRoute role="ADMIN"><AdminLegacyRedirect /></ProtectedRoute>} />
      </Route>

      {/* Catch-all for unmatched routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
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
