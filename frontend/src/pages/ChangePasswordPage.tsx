import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { getInstitutePath } from '../lib/instituteRoutes';

type PasswordErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export default function ChangePasswordPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { instituteId } = useParams();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const dashboardPath = useMemo(() => {
    if (user?.role === 'ADMIN') {
      return getInstitutePath(instituteId || null, '/admin');
    }
    return getInstitutePath(instituteId || null, '/dashboard');
  }, [instituteId, user?.role]);

  const validate = () => {
    const nextErrors: PasswordErrors = {};

    if (!currentPassword.trim()) {
      nextErrors.currentPassword = 'Current password is required.';
    }

    if (!newPassword.trim()) {
      nextErrors.newPassword = 'New password is required.';
    } else if (newPassword.length < 6) {
      nextErrors.newPassword = 'New password must be at least 6 characters.';
    }

    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Please confirm your new password.';
    } else if (confirmPassword !== newPassword) {
      nextErrors.confirmPassword = 'Confirm password does not match.';
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      nextErrors.newPassword = 'New password must be different from current password.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetMessages = () => {
    setFormError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const res = await api.patch('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      setSuccess(res.data?.message || 'Password changed successfully. Please log in again.');

      await logout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (Array.isArray(msg)) {
        setFormError(msg.join(', '));
      } else {
        setFormError(msg || err?.message || 'Failed to change password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-[hsl(var(--border))] bg-gradient-to-r from-[hsl(var(--primary)/0.08)] to-[hsl(var(--accent)/0.08)]">
          <h1 className="text-xl font-bold text-[hsl(var(--foreground))]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Change Password
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Update your account password securely. You can only change your own password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div className="rounded-xl border border-[hsl(var(--danger)/0.25)] bg-[hsl(var(--danger)/0.08)] px-4 py-3 text-sm text-[hsl(var(--danger))]">
              {formError}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success)/0.08)] px-4 py-3 text-sm text-[hsl(var(--success))]">
              {success}
            </div>
          )}

          <PasswordField
            label="Current Password"
            value={currentPassword}
            onChange={(value) => {
              setCurrentPassword(value);
              resetMessages();
            }}
            show={showCurrent}
            onToggle={() => setShowCurrent((prev) => !prev)}
            autoComplete="current-password"
            error={errors.currentPassword}
          />

          <PasswordField
            label="New Password"
            value={newPassword}
            onChange={(value) => {
              setNewPassword(value);
              resetMessages();
            }}
            show={showNew}
            onToggle={() => setShowNew((prev) => !prev)}
            autoComplete="new-password"
            error={errors.newPassword}
          />

          <PasswordField
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value);
              resetMessages();
            }}
            show={showConfirm}
            onToggle={() => setShowConfirm((prev) => !prev)}
            autoComplete="new-password"
            error={errors.confirmPassword}
          />

          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-3 text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
            After a successful password change, all active sessions will be logged out and you will need to sign in again.
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end pt-1">
            <Link
              to={dashboardPath}
              className="px-4 py-2.5 rounded-xl border border-[hsl(var(--border))] text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-glow))] text-white text-sm font-semibold shadow-md shadow-[hsl(var(--primary)/0.25)] hover:shadow-lg hover:shadow-[hsl(var(--primary)/0.35)] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
  error?: string;
};

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  error,
}: PasswordFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`w-full rounded-xl border bg-[hsl(var(--background))] px-3.5 py-2.5 pr-10 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] transition ${
            error ? 'border-[hsl(var(--danger)/0.5)]' : 'border-[hsl(var(--border))]'
          }`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? (
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18m-7.5-7.5A3 3 0 019.88 9.88m4.62 4.62A3 3 0 0112 15a3 3 0 01-2.121-.879m4.62-4.62L9.88 14.12m-6.844-2.122a10.523 10.523 0 014.293-5.774M9.88 4.879A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.45 10.45 0 01-1.596 2.94" />
            </svg>
          ) : (
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-[hsl(var(--danger))]">{error}</p>}
    </div>
  );
}
