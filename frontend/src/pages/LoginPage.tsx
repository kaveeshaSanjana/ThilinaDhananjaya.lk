import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/logo.png';
import heroBg from '../assets/students-learning.jpg';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
      <div className="flex-1 lg:flex-none lg:w-[46%] xl:w-[42%] flex items-center justify-center px-6 py-12 bg-white">
        <div className={`w-full max-w-[400px] transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>

          {/* Logo + branding */}
          <div className="flex flex-col items-center mb-7">
            <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mb-4 shadow-sm">
              <img src={logoImg} alt="logo" className="w-8 h-8 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Eazy English</h1>
            <p className="text-gray-600 font-medium mt-1">Welcome back</p>
            <p className="text-gray-400 text-sm mt-0.5">Please enter your details</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-start gap-2.5">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_16px_rgba(0,0,0,0.06)] p-6">
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Identifier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email, Phone, ID or Birth Certificate
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? (
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me + Forgot password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 accent-blue-600 cursor-pointer"
                  />
                  <span className="text-sm text-gray-600">Remember me</span>
                </label>
                <button type="button" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition">
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-1 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold text-sm tracking-wide transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
              >
                {loading && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </div>

          {/* Footer links */}
          <div className="mt-5 text-center space-y-2">
            <p className="text-sm text-gray-500">
              Registered by another one?{' '}
              <button type="button" className="text-blue-600 hover:text-blue-700 font-medium transition">
                Activate your account
              </button>
            </p>
            <p className="text-sm text-gray-500">
              New here?{' '}
              <button type="button" className="text-blue-600 hover:text-blue-700 font-medium transition">
                Create Account
              </button>
            </p>
          </div>

        </div>
      </div>

      {/* ═══════ RIGHT: Tech image panel ═══════ */}
      <div className="hidden lg:block flex-1 relative overflow-hidden">
        {/* Background image */}
        <img
          src={heroBg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        />
        {/* Dark blue tech overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(10,20,60,0.82) 0%, rgba(15,40,100,0.75) 40%, rgba(20,80,180,0.55) 100%)' }}
        />

        {/* Decorative glowing circles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full border border-blue-400/20 bg-blue-500/5 blur-sm" />
          <div className="absolute top-1/4 left-1/4 w-48 h-48 rounded-full border border-blue-400/15 bg-blue-500/5 translate-x-12 translate-y-12" />
          <div className="absolute bottom-1/4 right-1/4 w-56 h-56 rounded-full border border-blue-300/15 bg-blue-400/5" />
          <div className="absolute top-10 right-16 w-20 h-20 rounded-full border border-blue-400/25 bg-blue-500/10" />
          <div className="absolute bottom-20 left-16 w-16 h-16 rounded-full border border-blue-400/20 bg-blue-500/8" />
          {/* Floating icon badges */}
          <div className="absolute top-[18%] right-[20%] w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/30 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-blue-900/30">
            <svg className="w-6 h-6 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
            </svg>
          </div>
          <div className="absolute top-[40%] right-[8%] w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-400/30 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-blue-900/30">
            <svg className="w-6 h-6 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
          </div>
          <div className="absolute bottom-[28%] right-[18%] w-12 h-12 rounded-xl bg-blue-500/30 border border-blue-300/30 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-blue-900/30">
            <svg className="w-6 h-6 text-blue-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div className="absolute top-[60%] left-[10%] w-12 h-12 rounded-xl bg-sky-600/30 border border-sky-400/30 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-blue-900/30">
            <svg className="w-6 h-6 text-sky-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          {/* Glow behind center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        {/* Bottom text */}
        <div className="absolute bottom-10 left-10 right-10 z-10">
          <p className="text-white text-2xl font-bold leading-snug drop-shadow">
            Learn English<br />with Confidence
          </p>
          <p className="text-white/55 text-sm mt-1.5">Guided by Thilina Dhananjaya</p>
        </div>
      </div>

    </div>
  );
}
