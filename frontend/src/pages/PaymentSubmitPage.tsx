import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function PaymentSubmitPage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<any[]>([]);
  const [months, setMonths] = useState<any[]>([]);
  const [form, setForm] = useState({ classId: '', monthId: '', slipImage: '' });
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
      });
      setSuccess(true);
      setTimeout(() => navigate('/payments/my'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit. Please try again.');
    } finally { setLoading(false); }
  };

  if (success) return (
    <div className="max-w-md mx-auto mt-20 text-center animate-fade-in-up">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/30">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      </div>
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Payment submitted!</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Your slip has been sent for review. Redirecting...</p>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Upload Payment Slip</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Submit your monthly payment receipt for verification</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 sm:p-8 shadow-sm">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-sm text-red-600 dark:text-red-400 flex items-start gap-3 animate-fade-in">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Class</label>
            <select value={form.classId} onChange={e => { update('classId', e.target.value); update('monthId', ''); }} required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition shadow-sm">
              <option value="">Select a class</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Month</label>
            <select value={form.monthId} onChange={e => update('monthId', e.target.value)} required disabled={!form.classId}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition shadow-sm disabled:opacity-50">
              <option value="">{form.classId ? 'Select a month' : 'Select a class first'}</option>
              {months.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Payment slip</label>
            <label
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' : form.slipImage ? 'border-emerald-300 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' : 'border-slate-200 dark:border-slate-600 hover:border-blue-300 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}>
              {form.slipImage
                ? <img src={form.slipImage} alt="slip" className="h-full w-full object-contain rounded-xl p-2" />
                : <>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">Click or drag to upload</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">PNG, JPG up to 10MB</span>
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
