import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInstitutePath } from '../lib/instituteRoutes';

function formatDate(value?: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function displayValue(value?: string | null) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || '-';
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[hsl(var(--foreground))] break-words">{displayValue(value)}</p>
    </div>
  );
}

export default function StudentProfilePage() {
  const { user } = useAuth();
  const { instituteId } = useParams();

  const dashboardPath = useMemo(
    () => getInstitutePath(instituteId || null, '/dashboard'),
    [instituteId],
  );

  const profile = user?.profile;
  const initials = profile?.fullName
    ? profile.fullName
        .split(' ')
        .filter(Boolean)
        .map((name) => name[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : user?.email?.slice(0, 1).toUpperCase() || '?';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-[hsl(var(--border))] bg-gradient-to-r from-[hsl(var(--primary)/0.08)] to-[hsl(var(--accent)/0.08)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                My Profile
              </h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                View your student details. Profile editing is disabled for students.
              </p>
            </div>
            <Link
              to={dashboardPath}
              className="inline-flex items-center justify-center rounded-xl border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center text-white font-bold text-xl overflow-hidden shrink-0">
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.fullName || user?.email || 'Student'} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-[hsl(var(--foreground))] truncate">{displayValue(profile?.fullName)}</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))] truncate">{displayValue(user?.email)}</p>
              <p className="mt-2 inline-flex rounded-full border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.08)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--primary))]">
                Student ID: {displayValue(profile?.instituteId)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Personal</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow label="Full Name" value={profile?.fullName} />
              <DetailRow label="Email" value={user?.email} />
              <DetailRow label="Phone" value={profile?.phone} />
              <DetailRow label="WhatsApp" value={profile?.whatsappPhone} />
              <DetailRow label="Date of Birth" value={formatDate(profile?.dateOfBirth)} />
              <DetailRow label="Gender" value={profile?.gender} />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Academic</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow label="School" value={profile?.school} />
              <DetailRow label="Occupation" value={profile?.occupation} />
              <DetailRow label="Status" value={profile?.status} />
              <DetailRow label="Address" value={profile?.address} />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Guardian</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow label="Guardian Name" value={profile?.guardianName} />
              <DetailRow label="Guardian Phone" value={profile?.guardianPhone} />
              <DetailRow label="Relationship" value={profile?.relationship} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}