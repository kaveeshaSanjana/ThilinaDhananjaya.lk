import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { uploadImage } from '../lib/imageUpload';

const steps = ['Account', 'Profile', 'Confirm'];

export default function RegisterPage() {
  const { register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarName, setAvatarName] = useState('');
  const [form, setForm] = useState({ email: '', password: '', confirm: '', fullName: '', phone: '', school: '' });

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const nextStep = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (step === 0) {
      if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
      if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    }
    if (step < 2) setStep(s => s + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone.trim(),
        school: form.school.trim(),
        avatarUrl: avatarUrl || undefined,
      });
      navigate('/dashboard');
    } catch (err: any) { setError(err.response?.data?.message || 'Registration failed.'); setStep(0); }
    finally { setLoading(false); }
  };

  const handleAvatarUpload = async (file?: File) => {
    if (!file) return;
    setError('');
    setUploadingAvatar(true);
    try {
      const url = await uploadImage(file, 'avatars');
      setAvatarUrl(url);
      setAvatarName(file.name);
    } catch (err: any) {
      setError(err.message || 'Avatar upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all text-sm shadow-sm";

  const Field = ({ label, type = 'text', value, onChange, placeholder, required = false, hint }: any) => (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">{label}{!required && <span className="text-slate-400 ml-1 text-xs font-normal">(optional)</span>}</label>
      <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} required={required} className={inputCls} />
      {hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc]#0b1120] flex items-center justify-center p-6 relative transition-colors duration-300">
      {/* Theme toggle */}
      <button onClick={toggleTheme} className="absolute top-5 right-5 p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all" title="Toggle theme">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.7}>
          {theme === 'light'
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />}
        </svg>
      </button>

      <div className="w-full max-w-[480px] animate-fade-in">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <span className="text-white text-sm font-black">TD</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">ThilinaDhananjaya</p>
            <p className="text-[10px] text-slate-400">Learning Management System</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-800">Create your account</h1>
        <p className="text-slate-500 mt-1.5 text-sm mb-8">Join ThilinaDhananjaya LMS to start learning</p>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  i < step ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : i === step ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 ring-4 ring-blue-100'
                  : 'bg-slate-200 text-slate-400'
                }`}>
                  {i < step ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : i + 1}
                </div>
                <span className={`text-xs font-semibold hidden sm:block ${i === step ? 'text-blue-600' : 'text-slate-400'}`}>{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-[2px] rounded ml-1 transition-all ${i < step ? 'bg-blue-500' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 transition-colors duration-300">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 flex items-start gap-3 animate-fade-in">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{error}</span>
            </div>
          )}

          {step === 0 && (
            <form onSubmit={nextStep} className="space-y-5">
              <Field label="Email address" type="email" value={form.email} onChange={(v: string) => update('email', v)} placeholder="you@example.com" required />
              <Field label="Password" type="password" value={form.password} onChange={(v: string) => update('password', v)} placeholder="Min. 8 characters" required hint="At least 8 characters" />
              <Field label="Confirm password" type="password" value={form.confirm} onChange={(v: string) => update('confirm', v)} placeholder="Re-enter password" required />
              <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25 mt-2">Continue</button>
            </form>
          )}

          {step === 1 && (
            <form onSubmit={nextStep} className="space-y-5">
              <Field label="Full name" value={form.fullName} onChange={(v: string) => update('fullName', v)} placeholder="Your full name" required />
              <Field label="Phone number" type="tel" value={form.phone} onChange={(v: string) => update('phone', v)} placeholder="07X XXX XXXX" />
              <Field label="School / Institute" value={form.school} onChange={(v: string) => update('school', v)} placeholder="Your school name" />
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Profile photo <span className="text-slate-400 ml-1 text-xs font-normal">(optional)</span></label>
                <div className="flex items-center flex-wrap gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 hover:bg-blue-100 transition cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={e => handleAvatarUpload(e.target.files?.[0])}
                    />
                    {uploadingAvatar ? 'Uploading...' : 'Upload Avatar'}
                  </label>
                  <span className="text-[11px] text-slate-400">JPEG/PNG/WebP/GIF up to 5MB</span>
                </div>
                {avatarName && <p className="text-xs text-slate-500 mt-1.5">Selected: {avatarName}</p>}
                {avatarUrl && <img src={avatarUrl} alt="Avatar preview" className="mt-2 w-16 h-16 rounded-full object-cover border border-slate-200" />}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setStep(0)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Back</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25">Continue</button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
              <div className="space-y-1">
                {[['Email', form.email], ['Name', form.fullName], ...(form.phone ? [['Phone', form.phone]] : []), ...(form.school ? [['School', form.school]] : [])].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
                    <span className="text-sm text-slate-500">{k}</span>
                    <span className="text-sm font-semibold text-slate-800">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">Back</button>
                <button type="submit" disabled={loading || uploadingAvatar}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                  {loading ? 'Creating...' : 'Create account'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-semibold hover:text-blue-700 transition">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
