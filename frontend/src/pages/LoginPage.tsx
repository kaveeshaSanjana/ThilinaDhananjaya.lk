import { type FocusEvent, type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';
import thilinaLogo from '../assets/logo.png';
import thilinaLoginIllustration from '../assets/thilinadhananjaya.png';

const BRAND_APP_NAME = 'Thilina Dhananjaya';
const BRAND_WELCOME_TITLE = 'Welcome back';
const BRAND_WELCOME_SUBTITLE = 'Please enter your details';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Track keyboard visibility so mobile layout remains usable when typing.
  const [origHeight] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 812));
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const onResize = () => setKeyboardVisible(window.innerHeight < origHeight - 150);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [origHeight]);

  const scrollInputIntoView = (e: FocusEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
    }
  };

  const handleActivateAccount = () => {
    navigate('/register');
  };

  const handleCreateAccount = () => {
    navigate('/register');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row overflow-x-hidden bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100">
      {/* Top image on mobile. Hidden while keyboard is open. */}
      <div className={`block md:hidden w-full relative h-[25vh] shrink-0 overflow-hidden border-b border-blue-200/60 transition-all duration-200${keyboardVisible ? ' hidden' : ''}`}>
        <img
          src={thilinaLoginIllustration}
          alt="Education illustration"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Left column: login content */}
      <div
        className="w-full md:w-3/5 lg:w-1/2 flex flex-col items-center justify-center px-5 py-7 sm:p-7 md:p-10 bg-white/95 backdrop-blur-sm -mt-8 md:mt-0 rounded-t-[3rem] md:rounded-none relative z-10 flex-1 md:min-h-screen overflow-y-auto"
        onFocusCapture={scrollInputIntoView}
      >
        <div className="w-full max-w-md md:max-w-lg space-y-6 md:space-y-7">
          {/* Logo and heading */}
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-2 md:mb-4">
              <div className="w-12 h-12 md:w-20 md:h-20 rounded-lg overflow-hidden">
                <img src={thilinaLogo} alt={`${BRAND_APP_NAME} logo`} className="w-full h-full object-contain" loading="lazy" />
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{BRAND_APP_NAME}</h1>
            <p className="text-base md:text-lg font-normal text-slate-700">{BRAND_WELCOME_TITLE}</p>
            <p className="text-sm md:text-sm text-slate-500">{BRAND_WELCOME_SUBTITLE}</p>
          </div>

          <Card className="border-blue-100 bg-white shadow-[0_12px_35px_rgba(30,64,175,0.12)] lg:shadow-[0_20px_45px_rgba(30,64,175,0.14)]">
            <CardContent className="p-5 md:p-8 lg:p-10">
              <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                <div className="space-y-1.5">
                  <label htmlFor="identifier" className="text-sm font-medium text-slate-700 block">Email, Phone, or Student ID</label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="Enter email, phone, or student ID"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    className="h-11 md:h-11 text-sm md:text-base rounded-lg border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/35 focus-visible:ring-offset-0"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700 block">Password</label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 md:h-11 text-sm md:text-base pr-12 rounded-lg border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/35 focus-visible:ring-offset-0"
                      autoComplete="current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-transparent touch-manipulation"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="remember"
                      className="rounded border-slate-300 w-4 h-4 accent-blue-600"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <label htmlFor="remember" className="text-xs md:text-sm text-slate-600 cursor-pointer select-none">
                      Remember me
                    </label>
                  </div>

                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setError('Please contact your institute admin to reset your password.')}
                    className="text-xs md:text-sm text-blue-600 hover:text-blue-700 p-0 h-auto font-medium"
                  >
                    Forgot password?
                  </Button>
                </div>

                {error && (
                  <div className="text-xs md:text-sm text-red-700 bg-red-50 border border-red-200 p-2.5 md:p-3 rounded-lg">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 md:h-12 text-sm md:text-base font-semibold touch-manipulation active:scale-[0.98] transition-transform rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>

                <div className="text-center pt-2 space-y-1.5">
                  <div>
                    <span className="text-xs md:text-sm text-slate-500">Registered by another one? </span>
                    <Button
                      type="button"
                      variant="link"
                      onClick={handleActivateAccount}
                      className="text-xs md:text-sm text-blue-600 hover:text-blue-700 p-0 h-auto font-medium"
                    >
                      Activate your account
                    </Button>
                  </div>

                  <div>
                    <span className="text-xs md:text-sm text-slate-500">New here? </span>
                    <Button
                      type="button"
                      variant="link"
                      onClick={handleCreateAccount}
                      className="text-xs md:text-sm text-blue-600 hover:text-blue-700 p-0 h-auto font-medium"
                    >
                      Create Account
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right image section - no overlays */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 relative min-h-[300px] md:min-h-screen border-l border-blue-100/70">
        <img
          src={thilinaLoginIllustration}
          alt="Education illustration"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    </div>
  );
}
