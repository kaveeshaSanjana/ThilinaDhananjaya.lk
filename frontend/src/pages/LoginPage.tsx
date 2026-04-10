import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import studentsImg from '../assets/students-learning.jpg';
import logoImg from '../assets/logo.png';


export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const u = await login(identifier, password);
      const redirect = searchParams.get('redirect');
      if (u?.role === 'ADMIN') {
        const target = redirect && redirect.startsWith('/')
          ? `/admin/select-institute?redirect=${encodeURIComponent(redirect)}`
          : '/admin/select-institute';
        navigate(target);
      } else if (redirect && redirect.startsWith('/')) {
        navigate(redirect);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-white">

      {/* ═══════ LEFT: Form panel ═══════ */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-14 xl:px-20 bg-white">
        <div className={`w-full max-w-[400px] transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

          {/* Logo — centered */}
          <div className="flex flex-col items-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center mb-3 ring-1 ring-[hsl(var(--primary)/0.15)]">
              <img src={logoImg} alt="Eazy English" className="w-9 h-9 object-contain" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Eazy English</h1>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-200 mt-0.5">Welcome back</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Please enter your details</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-3">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Identifier */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Email, Phone, ID or Birth Certificate
              </label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                placeholder="Enter your identifier"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.35)] focus:border-[hsl(var(--primary)/0.5)] transition text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 pr-11 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.35)] focus:border-[hsl(var(--primary)/0.5)] transition text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition rounded-lg"
                >
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    {showPw
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      : <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            {/* Remember me + Forgot password row */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-[hsl(var(--primary))] accent-[hsl(var(--primary))]" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Remember me</span>
              </label>
              <span className="text-sm font-medium text-[hsl(var(--primary))] hover:underline cursor-pointer">
                Forgot password?
              </span>
            </div>

            {/* Submit */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm tracking-wide active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-[hsl(var(--primary)/0.25)]"
                style={{ background: 'hsl(var(--primary))' }}
              >
                {loading && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          {/* Bottom links */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Registered by another one?{' '}
              <Link to="/register" className="font-semibold text-[hsl(var(--primary))] hover:underline">
                Activate your account
              </Link>
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              New here?{' '}
              <Link to="/register" className="font-semibold text-[hsl(var(--primary))] hover:underline">
                Create Account
              </Link>
            </p>
          </div>

        </div>
      </div>

      {/* ═══════ RIGHT: Student image panel ═══════ */}
      <div className="hidden lg:block lg:w-[54%] xl:w-[58%] relative overflow-hidden">
        <img
          src={studentsImg}
          alt="Students learning"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Blue overlay matching the screenshot */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, hsl(221,83%,45%,0.82) 0%, hsl(217,91%,58%,0.65) 60%, hsl(213,94%,68%,0.40) 100%)' }} />
        {/* Bottom tagline */}
        <div className="absolute bottom-0 left-0 right-0 px-12 py-10">
          <p className="text-white text-2xl font-extrabold leading-snug drop-shadow-md">
            Learn English<br />with Confidence
          </p>
          <p className="text-white/70 text-sm mt-2 drop-shadow">
            Guided by Thilina Dhananjaya
          </p>
        </div>
      </div>

    </div>
  );
}
