import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInstitute } from '../context/InstituteContext';
import { getInstituteAdminPath } from '../lib/instituteRoutes';

export default function LandingPage() {
  const { user } = useAuth();
  const { selected } = useInstitute();
  const [landingHtml, setLandingHtml] = useState<string | null>(null);

  useEffect(() => {
    fetch('/landing-page.html')
      .then(r => r.text())
      .then(html => setLandingHtml(html))
      .catch(() => setLandingHtml('<div>Landing page failed to load</div>'));
  }, []);

  // If user is authenticated, redirect to appropriate dashboard
  if (user) {
    if (user.role === 'ADMIN' && selected) {
      return <Navigate to={getInstituteAdminPath(selected.id)} replace />;
    }
    if (user.role === 'STUDENT') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // For unauthenticated users, show the static landing page
  if (!landingHtml) {
    return <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ width: '100%', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'auto'
        }}
        dangerouslySetInnerHTML={{ __html: landingHtml }}
      />
    </div>
  );
}
