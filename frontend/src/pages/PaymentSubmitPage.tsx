import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { getInstitutePath } from '../lib/instituteRoutes';

export default function PaymentSubmitPage() {
  const navigate = useNavigate();
  const { instituteId } = useParams();
  const [classes, setClasses] = useState<any[]>([]);
  const [months, setMonths] = useState<any[]>([]);
  const [form, setForm] = useState({ classId: '', monthId: '', slipImage: '', paymentMethod: '', paymentPortion: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data)).catch(() => {});
  }, []);

  // Load months when class changes
  useEffect(() => {
    if (form.classId) {
      api.get(`/classes/${form.classId}/months`).then(r => setMonths(r.data)).catch(() => setMonths([]));
    } else {
      setMonths([]);
    }
  }, [form.classId]);

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => update('slipImage', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) handleImage(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.post('/payments/submit', {
        monthId: form.monthId,
        type: 'MONTHLY',
        slipUrl: form.slipImage,
        paymentMethod: form.paymentMethod || undefined,
        paymentPortion: form.paymentPortion || undefined,
      });
      setSuccess(true);
      setTimeout(() => navigate(getInstitutePath(instituteId, '/payments/my')), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit. Please try again.');
    } finally { setLoading(false); }
  };

  if (success) return (
    <div className="w-full mt-20 text-center animate-fade-in-up">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/30">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      </div>
      <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">Payment submitted!</h2>
      <p className="text-[hsl(var(--muted-foreground))] text-sm mt-2">Your slip has been sent for review. Redirecting...</p>
    </div>
  );

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Upload Payment Slip</h1>
        <p className="text-[hsl(var(--muted-foreground))] text-sm mt-0.5">Submit your monthly payment receipt for verification</p>
      </div>

      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6 sm:p-8 shadow-sm">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 flex items-start gap-3 animate-fade-in">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[hsl(var(--foreground))] mb-2">Class</label>
            <select value={form.classId} onChange={e => { update('classId', e.target.value); update('monthId', ''); }} required
              className="w-full px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition shadow-sm">
              <option value="">Select a class</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[hsl(var(--foreground))] mb-2">Month</label>
            <select value={form.monthId} onChange={e => update('monthId', e.target.value)} required disabled={!form.classId}
              className="w-full px-4 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition shadow-sm disabled:opacity-50">
              <option value="">{form.classId ? 'Select a month' : 'Select a class first'}</option>
              {months.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[hsl(var(--foreground))] mb-2">Payment Method <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'ONLINE', label: 'Online Payment', desc: 'Bank transfer / online banking', icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                )},
                { value: 'PHYSICAL', label: 'Physical Payment', desc: 'Cash / in-person payment', icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                )},
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => update('paymentMethod', opt.value)}
                  className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border-2 transition text-left ${
                    form.paymentMethod === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-[hsl(var(--border))] hover:border-blue-300 bg-[hsl(var(--card))]'
                  }`}>
                  <span className={form.paymentMethod === opt.value ? 'text-blue-600' : 'text-slate-500'}>{opt.icon}</span>
                  <span className={`text-sm font-semibold ${form.paymentMethod === opt.value ? 'text-blue-700' : 'text-[hsl(var(--foreground))]'}`}>{opt.label}</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{opt.desc}</span>
                </button>
              ))}
            </div>
            <input type="text" required value={form.paymentMethod} onChange={() => {}} className="sr-only" tabIndex={-1} aria-hidden="true" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[hsl(var(--foreground))] mb-2">Payment Amount <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'FULL', label: 'Full Payment', desc: 'Pay the full monthly fee' },
                { value: 'HALF', label: 'Half Payment', desc: 'Pay half of the monthly fee' },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => update('paymentPortion', opt.value)}
                  className={`flex flex-col items-start gap-1 p-3.5 rounded-xl border-2 transition text-left ${
                    form.paymentPortion === opt.value
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-[hsl(var(--border))] hover:border-emerald-300 bg-[hsl(var(--card))]'
                  }`}>
                  <span className={`text-sm font-semibold ${form.paymentPortion === opt.value ? 'text-emerald-700' : 'text-[hsl(var(--foreground))]'}`}>{opt.label}</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{opt.desc}</span>
                </button>
              ))}
            </div>
            <input type="text" required value={form.paymentPortion} onChange={() => {}} className="sr-only" tabIndex={-1} aria-hidden="true" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[hsl(var(--foreground))] mb-2">Payment slip</label>
            <label
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                dragOver ? 'border-blue-400 bg-[hsl(var(--primary)/0.05)]' : form.slipImage ? 'border-emerald-300 bg-emerald-50/20' : 'border-[hsl(var(--border))] hover:border-blue-300 bg-[hsl(var(--muted))] hover:bg-[hsl(var(--primary)/0.03)]'
              }`}>
              {form.slipImage
                ? <img src={form.slipImage} alt="slip" className="h-full w-full object-contain rounded-xl p-2" />
                : <>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    </div>
                    <span className="text-sm text-[hsl(var(--foreground))] font-medium">Click or drag to upload</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">PNG, JPG up to 10MB</span>
                  </>
              }
              <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f); }} required={!form.slipImage} className="hidden" />
            </label>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 mt-2">
            {loading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
            {loading ? 'Submitting...' : 'Submit Payment Slip'}
          </button>
        </form>
      </div>
    </div>
  );
}
