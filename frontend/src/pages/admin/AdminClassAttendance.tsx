import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../lib/api';
import StickyDataTable, { type StickyColumn } from '../../components/StickyDataTable';
import { getInstituteAdminPath } from '../../lib/instituteRoutes';

/* ─── Types ──────────────────────────────────────────── */

interface ClassItem { id: string; name: string; subject?: string; monthlyFee?: number }
interface Student { userId: string; fullName: string; instituteId: string; barcodeId?: string | null; phone?: string; status?: string }
interface AttendanceRecord {
  id: string; userId: string; classId: string; date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  method?: string; note?: string;
  user?: { profile?: { fullName?: string; instituteId?: string; barcodeId?: string; phone?: string; avatarUrl?: string | null } };
}
interface PaymentMonth {
  id: string;
  name: string;
  year: number;
  month: number;
}

interface PaymentOverviewStudent {
  userId: string;
  email: string;
  profile?: {
    fullName?: string;
    instituteId?: string;
    avatarUrl?: string | null;
    phone?: string;
  };
  paymentStatus: 'PAID' | 'LATE' | 'PENDING' | 'UNPAID';
  slip?: {
    id: string;
    status: string;
    type?: string;
    slipUrl?: string;
    adminNote?: string | null;
    createdAt?: string;
  } | null;
}

interface PaymentOverview {
  summary: { total: number; paid: number; late: number; pending: number; unpaid: number };
  students: PaymentOverviewStudent[];
}

/* ─── Status Config ──────────────────────────────────── */

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  PRESENT: { label: 'Present', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: '✓' },
  ABSENT:  { label: 'Absent',  color: 'text-red-600',     bg: 'bg-red-50 border-red-200',         icon: '✕' },
  LATE:    { label: 'Late',    color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',     icon: '⏱' },
  EXCUSED: { label: 'Excused', color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200',       icon: '!' },
};

const PAY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  PAID:    { label: 'Paid',    color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  LATE:    { label: 'Late',    color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  PENDING: { label: 'Pending', color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
  UNPAID:  { label: 'Unpaid',  color: 'text-red-600',     bg: 'bg-red-50 border-red-200' },
};

type TabKey = 'mark' | 'monthly' | 'yearly' | 'payments';
type AttendanceFilter = 'all' | 'absent-last-week' | 'absent-last-month' | 'low-attendance' | 'never-attended';
type MarkFilter = 'all' | 'unmarked' | 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

/* ─── Helpers ────────────────────────────────────────── */

function toDateStr(d: Date) { return d.toISOString().split('T')[0]; }
function fmtDate(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }); }
function monthLabel(y: number, m: number) { return new Date(y, m - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
function shortMonth(m: number) { return new Date(2000, m - 1).toLocaleDateString('en-GB', { month: 'short' }); }

function normalizeScannedIdentifier(raw: string) {
  const value = raw.trim();
  if (!value) return '';

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      const keys = ['barcode', 'barcodeId', 'identifier', 'studentId', 'instituteId', 'id', 'code'];
      for (const key of keys) {
        const candidate = parsed[key];
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      }
    }
  } catch {
    // Not JSON payload.
  }

  try {
    const url = new URL(value);
    const keys = ['barcode', 'barcodeId', 'identifier', 'studentId', 'instituteId', 'id', 'code'];
    for (const key of keys) {
      const candidate = url.searchParams.get(key);
      if (candidate && candidate.trim()) return candidate.trim();
    }
    const lastPathPart = url.pathname.split('/').filter(Boolean).pop();
    if (lastPathPart) return decodeURIComponent(lastPathPart).trim();
  } catch {
    // Not URL payload.
  }

  return value;
}

/* ─── Barcode Scanner Hook ───────────────────────────── */

function useBarcodeScanner(onScan: (code: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastScanRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });

  // Keyboard barcode scanner (USB scanners type fast + Enter)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Enter' && bufferRef.current.length >= 3) {
        onScan(bufferRef.current);
        bufferRef.current = '';
        return;
      }
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { bufferRef.current = ''; }, 200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(timerRef.current); };
  }, [onScan]);

  const detectFrame = useCallback(async () => {
    const video = videoRef.current;
    if (video && detectorRef.current && video.readyState >= 2) {
      try {
        const detected = await detectorRef.current.detect(video);
        const raw = detected?.find((item: any) => typeof item?.rawValue === 'string' && item.rawValue.trim())?.rawValue;
        if (typeof raw === 'string') {
          const normalized = raw.trim();
          const now = Date.now();
          if (normalized && (normalized !== lastScanRef.current.value || now - lastScanRef.current.at > 900)) {
            lastScanRef.current = { value: normalized, at: now };
            onScan(normalized);
          }
        }
      } catch {
        // Continue scanning on decode frame errors.
      }
    }

    rafRef.current = window.requestAnimationFrame(() => {
      void detectFrame();
    });
  }, [onScan]);

  const startCamera = useCallback(async () => {
    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      setError('Camera auto-detect requires Chrome/Edge (BarcodeDetector support). USB scanner still works.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      detectorRef.current = new BarcodeDetectorCtor({
        formats: ['qr_code', 'code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'],
      });
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = window.requestAnimationFrame(() => {
        void detectFrame();
      });
      setActive(true); setError('');
    } catch { setError('Camera access denied'); }
  }, [detectFrame]);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    detectorRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      clearTimeout(timerRef.current);
    };
  }, [stopCamera]);

  return { videoRef, active, error, startCamera, stopCamera };
}

/* ═══════════════════════════════════════════════════════ */
/*                    MAIN COMPONENT                      */
/* ═══════════════════════════════════════════════════════ */

export default function AdminClassAttendance() {
  const { instituteId } = useParams<{ instituteId: string }>();

  /* ─── State ──────────────────────────────────── */
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [yearRecords, setYearRecords] = useState<AttendanceRecord[]>([]);
  const [paymentMonths, setPaymentMonths] = useState<PaymentMonth[]>([]);
  const [paymentMonthId, setPaymentMonthId] = useState('');
  const [paymentOverview, setPaymentOverview] = useState<PaymentOverview | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentUpdatingId, setPaymentUpdatingId] = useState('');

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);

  const [tab, setTab] = useState<TabKey>('monthly');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [search, setSearch] = useState('');
  const [attFilter, setAttFilter] = useState<AttendanceFilter>('all');
  const [payFilter, setPayFilter] = useState<'all' | 'PAID' | 'LATE' | 'PENDING' | 'UNPAID'>('all');
  const [markFilter, setMarkFilter] = useState<MarkFilter>('all');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const [savedStatuses, setSavedStatuses] = useState<Record<string, string>>({});
  const [recentScans, setRecentScans] = useState<Array<{ name: string; time: string; id: string }>>([]);
  const [scanState, setScanState] = useState<'ready' | 'waiting' | 'success' | 'error'>('ready');
  const [scanStudent, setScanStudent] = useState<{ name: string; identifier: string; avatarUrl?: string } | null>(null);
  const [lastMarkedId, setLastMarkedId] = useState('');

  const scanRef = useRef<HTMLInputElement>(null);
  const scanResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMarkedStorageKey = useMemo(
    () => (selectedClassId ? `class-attendance:last-marked:${selectedClassId}:${selectedDate}` : ''),
    [selectedClassId, selectedDate],
  );

  /* ─── Barcode scanner ─────────────────────────── */

  const submitAttendanceScan = useCallback(async (rawCode: string, method: string) => {
    const normalized = normalizeScannedIdentifier(rawCode);
    if (!normalized || !selectedClassId) return;

    setScanInput(normalized);

    if (scanState === 'waiting') return;

    if (normalized === lastMarkedId) {
      setToast({ type: 'error', msg: `Duplicate ignored: ${normalized}` });
      return;
    }

    setScanState('waiting');
    setScanStudent(null);

    try {
      const res = await api.post('/attendance/class-attendance/mark', {
        classId: selectedClassId,
        identifier: normalized,
        date: selectedDate,
        status: 'PRESENT',
        method,
      });

      const profile = res.data?.user?.profile;
      const name = profile?.fullName || normalized;

      setLocalStatuses(prev => ({ ...prev, [res.data.userId]: 'PRESENT' }));
      setRecentScans(prev => [{ name, time: new Date().toLocaleTimeString(), id: normalized }, ...prev.slice(0, 19)]);
      setLastMarkedId(normalized);
      setScanStudent({
        name,
        identifier: normalized,
        avatarUrl: profile?.avatarUrl || undefined,
      });
      setScanState('success');
      setToast({ type: 'success', msg: `✓ ${name} — Present` });

      if (scanResultTimerRef.current) clearTimeout(scanResultTimerRef.current);
      scanResultTimerRef.current = setTimeout(() => {
        setScanStudent(null);
        setScanInput('');
        setScanState('ready');
        scanRef.current?.focus();
      }, 1800);
    } catch (err: any) {
      setScanState('error');
      setToast({ type: 'error', msg: err.response?.data?.message || 'Student not found' });
      if (scanResultTimerRef.current) clearTimeout(scanResultTimerRef.current);
      scanResultTimerRef.current = setTimeout(() => {
        setScanState('ready');
        scanRef.current?.focus();
      }, 1200);
    }
  }, [lastMarkedId, scanState, selectedClassId, selectedDate]);

  const handleBarcodeScan = useCallback((code: string) => {
    void submitAttendanceScan(code, 'scan');
  }, [submitAttendanceScan]);

  const scanner = useBarcodeScanner(handleBarcodeScan);

  /* ─── Load Classes ─────────────────────────────── */

  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  /* ─── Load Students when class changes ─────────── */

  useEffect(() => {
    if (!selectedClassId) { setStudents([]); setLocalStatuses({}); setSavedStatuses({}); return; }
    setLoading(true);
    api.get(`/attendance/class-attendance/class/${selectedClassId}/students`)
      .then(r => setStudents(r.data || []))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [selectedClassId]);

  /* ─── Load attendance for selected date ─────────── */

  useEffect(() => {
    if (!selectedClassId || !selectedDate) return;
    api.get(`/attendance/class-attendance/class/${selectedClassId}/date/${selectedDate}`)
      .then(r => {
        const map: Record<string, string> = {};
        (r.data || []).forEach((a: AttendanceRecord) => { map[a.userId] = a.status; });
        setLocalStatuses(map);
        setSavedStatuses(map);
      }).catch(() => {});
  }, [selectedClassId, selectedDate]);

  /* ─── Load monthly view ────────────────────────── */

  useEffect(() => {
    if (!selectedClassId || tab !== 'monthly') return;
    api.get(`/attendance/class-attendance/class/${selectedClassId}/month/${viewYear}/${viewMonth}`)
      .then(r => setMonthRecords(r.data || []))
      .catch(() => setMonthRecords([]));
  }, [selectedClassId, viewYear, viewMonth, tab]);

  /* ─── Load yearly view ─────────────────────────── */

  useEffect(() => {
    if (!selectedClassId || tab !== 'yearly') return;
    api.get(`/attendance/class-attendance/class/${selectedClassId}/year/${viewYear}`)
      .then(r => setYearRecords(r.data || []))
      .catch(() => setYearRecords([]));
  }, [selectedClassId, viewYear, tab]);

  /* ─── Load payment months + overview ───────────────── */

  const paymentClassRef = useRef('');

  const loadPaymentOverview = useCallback(async (classId: string, monthId: string) => {
    setPaymentLoading(true);
    setPaymentError('');
    try {
      const { data } = await api.get(`/payments/class/${classId}/month/${monthId}`);
      setPaymentOverview(data || null);
    } catch (err: any) {
      setPaymentOverview(null);
      setPaymentError(err.response?.data?.message || 'Failed to load payment overview');
    } finally {
      setPaymentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedClassId || tab !== 'payments') return;
    paymentClassRef.current = selectedClassId;
    setPaymentOverview(null);
    setPaymentMonthId('');
    setPaymentMonths([]);
    setPaymentLoading(true);
    setPaymentError('');
    api.get(`/classes/${selectedClassId}/months`)
      .then(async r => {
        const months = (r.data || []) as PaymentMonth[];
        setPaymentMonths(months);
        if (months.length === 0) {
          setPaymentError('No months found for this class');
          setPaymentLoading(false);
          return;
        }
        const lastMonth = months[months.length - 1];
        setPaymentMonthId(lastMonth.id);
        await loadPaymentOverview(selectedClassId, lastMonth.id);
      })
      .catch(() => {
        setPaymentMonths([]);
        setPaymentError('Failed to load class months');
        setPaymentLoading(false);
      });
  }, [selectedClassId, tab, loadPaymentOverview]);

  /* ─── Toast auto-dismiss ───────────────────────── */

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  useEffect(() => {
    if (!lastMarkedStorageKey) {
      setLastMarkedId('');
      return;
    }
    setLastMarkedId(localStorage.getItem(lastMarkedStorageKey) || '');
  }, [lastMarkedStorageKey]);

  useEffect(() => {
    if (!lastMarkedStorageKey) return;
    if (lastMarkedId) localStorage.setItem(lastMarkedStorageKey, lastMarkedId);
    else localStorage.removeItem(lastMarkedStorageKey);
  }, [lastMarkedStorageKey, lastMarkedId]);

  useEffect(() => {
    return () => {
      if (scanResultTimerRef.current) clearTimeout(scanResultTimerRef.current);
    };
  }, []);

  /* ─── Handlers ─────────────────────────────────── */

  const setStudentStatus = useCallback((userId: string, status: string) => {
    setLocalStatuses(prev => ({ ...prev, [userId]: status }));
  }, []);

  const handleScanMark = useCallback(async () => {
    if (!scanInput.trim()) return;
    await submitAttendanceScan(scanInput, 'manual');
  }, [scanInput, submitAttendanceScan]);

  const handleBulkSave = useCallback(async () => {
    if (!selectedClassId) return;
    const hasDiff = students.some(s => (localStatuses[s.userId] || '') !== (savedStatuses[s.userId] || ''));
    if (!hasDiff) { setToast({ type: 'error', msg: 'No changes to save' }); return; }
    const records = Object.entries(localStatuses).map(([userId, status]) => ({ userId, status }));
    if (records.length === 0) { setToast({ type: 'error', msg: 'No attendance marked yet' }); return; }
    setSaving(true);
    try {
      await api.post('/attendance/class-attendance/bulk', { classId: selectedClassId, date: selectedDate, records, method: 'manual' });
      setToast({ type: 'success', msg: `Saved attendance for ${records.length} students` });
      setSavedStatuses(localStatuses);
    } catch (err: any) { setToast({ type: 'error', msg: err.response?.data?.message || 'Failed to save' }); }
    finally { setSaving(false); }
  }, [selectedClassId, selectedDate, localStatuses, savedStatuses, students]);

  /* ─── Derived ──────────────────────────────────── */

  const filteredStudents = useMemo(() => {
    let list = students;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.fullName.toLowerCase().includes(q) || s.instituteId.toLowerCase().includes(q) ||
        (s.barcodeId || '').toLowerCase().includes(q) || (s.phone || '').includes(q)
      );
    }
    if (markFilter !== 'all') {
      list = list.filter(s => {
        const st = localStatuses[s.userId] || '';
        return markFilter === 'unmarked' ? !st : st === markFilter;
      });
    }
    return list;
  }, [students, search, markFilter, localStatuses]);

  // Monthly summary grouped by student
  const monthlySummary = useMemo(() => {
    const map = new Map<string, { student: AttendanceRecord['user']; userId: string; dates: Record<string, string>; counts: Record<string, number> }>();
    for (const rec of monthRecords) {
      if (!map.has(rec.userId)) map.set(rec.userId, { student: rec.user, userId: rec.userId, dates: {}, counts: { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } });
      const entry = map.get(rec.userId)!;
      entry.dates[rec.date.split('T')[0]] = rec.status;
      entry.counts[rec.status] = (entry.counts[rec.status] || 0) + 1;
    }
    return Array.from(map.values()).sort((a, b) => (a.student?.profile?.fullName || '').localeCompare(b.student?.profile?.fullName || ''));
  }, [monthRecords]);

  const monthDates = useMemo(() => {
    const set = new Set<string>();
    monthRecords.forEach(r => set.add(r.date.split('T')[0]));
    return Array.from(set).sort();
  }, [monthRecords]);

  // Yearly summary: per student, per month aggregated
  const yearlySummary = useMemo(() => {
    const map = new Map<string, { student: AttendanceRecord['user']; userId: string; months: Record<number, Record<string, number>>; totalP: number; totalA: number; totalL: number; total: number; dates: Record<string, string> }>();
    for (const rec of yearRecords) {
      if (!map.has(rec.userId)) map.set(rec.userId, { student: rec.user, userId: rec.userId, months: {}, totalP: 0, totalA: 0, totalL: 0, total: 0, dates: {} });
      const entry = map.get(rec.userId)!;
      const d = new Date(rec.date);
      const m = d.getMonth() + 1;
      if (!entry.months[m]) entry.months[m] = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
      entry.months[m][rec.status] = (entry.months[m][rec.status] || 0) + 1;
      if (rec.status === 'PRESENT') entry.totalP++;
      else if (rec.status === 'ABSENT') entry.totalA++;
      else if (rec.status === 'LATE') entry.totalL++;
      entry.total++;
      entry.dates[rec.date.split('T')[0]] = rec.status;
    }
    let list = Array.from(map.values()).sort((a, b) => (a.student?.profile?.fullName || '').localeCompare(b.student?.profile?.fullName || ''));

    // Apply filters
    if (attFilter === 'absent-last-week') {
      const now = new Date(); const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      list = list.filter(s => {
        return Object.entries(s.dates).some(([d, st]) => {
          const dt = new Date(d + 'T00:00:00');
          return dt >= weekAgo && dt <= now && st === 'ABSENT';
        });
      });
    } else if (attFilter === 'absent-last-month') {
      const now = new Date(); const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1);
      list = list.filter(s => Object.entries(s.dates).some(([d, st]) => new Date(d + 'T00:00:00') >= monthAgo && st === 'ABSENT'));
    } else if (attFilter === 'low-attendance') {
      list = list.filter(s => s.total > 0 && ((s.totalP + s.totalL) / s.total) < 0.5);
    } else if (attFilter === 'never-attended') {
      list = list.filter(s => s.total === 0 || s.totalP === 0);
    }
    return list;
  }, [yearRecords, attFilter]);

  // Active months in year (1-12)
  const yearActiveMonths = useMemo(() => {
    const set = new Set<number>();
    yearRecords.forEach(r => set.add(new Date(r.date).getMonth() + 1));
    return Array.from(set).sort((a, b) => a - b);
  }, [yearRecords]);

  // Stats for mark tab
  const stats = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
    for (const s of students) {
      const st = localStatuses[s.userId];
      if (st === 'PRESENT') c.present++; else if (st === 'ABSENT') c.absent++;
      else if (st === 'LATE') c.late++; else if (st === 'EXCUSED') c.excused++; else c.unmarked++;
    }
    return c;
  }, [students, localStatuses]);

  const hasUnsavedChanges = useMemo(() => {
    return students.some(s => (localStatuses[s.userId] || '') !== (savedStatuses[s.userId] || ''));
  }, [students, localStatuses, savedStatuses]);

  const changedCount = useMemo(() => {
    return students.reduce((count, s) => count + (((localStatuses[s.userId] || '') !== (savedStatuses[s.userId] || '')) ? 1 : 0), 0);
  }, [students, localStatuses, savedStatuses]);

  const setStudentPaymentStatus = useCallback(async (userId: string, status: 'PAID' | 'LATE' | 'UNPAID') => {
    if (!paymentMonthId) return;
    setPaymentUpdatingId(`${userId}:${status}`);
    try {
      await api.patch(`/payments/student/${userId}/month/${paymentMonthId}/status`, { status, adminNote: '' });
      setToast({ type: 'success', msg: `Payment marked as ${status}` });
      await loadPaymentOverview(paymentClassRef.current, paymentMonthId);
    } catch (err: any) {
      setToast({ type: 'error', msg: err.response?.data?.message || 'Failed to update payment status' });
    } finally {
      setPaymentUpdatingId('');
    }
  }, [paymentMonthId, loadPaymentOverview]);

  // Payment filter
  const filteredPayStudents = useMemo(() => {
    if (!paymentOverview) return [];
    let list = paymentOverview.students;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        (s.profile?.fullName || '').toLowerCase().includes(q) ||
        (s.profile?.instituteId || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      );
    }
    if (payFilter !== 'all') list = list.filter(s => s.paymentStatus === payFilter);
    return list;
  }, [paymentOverview, search, payFilter]);

  const paymentCounts = useMemo(() => {
    const summary = paymentOverview?.summary;
    return {
      all: summary?.total || 0,
      PAID: summary?.paid || 0,
      LATE: summary?.late || 0,
      PENDING: summary?.pending || 0,
      UNPAID: summary?.unpaid || 0,
    };
  }, [paymentOverview]);

  const selectedClass = classes.find(c => c.id === selectedClassId);

  const markColumns = useMemo<readonly StickyColumn<Student>[]>(() => [
    {
      id: 'student',
      label: 'Student',
      minWidth: 230,
      render: (student) => (
        <div className="flex items-center gap-3 min-w-0">
          <Initials name={student.fullName} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm truncate">{student.fullName}</p>
            <p className="text-[11px] text-slate-400 font-mono">{student.instituteId}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'instituteId',
      label: 'Institute ID',
      minWidth: 130,
      render: (student) => <span className="text-xs font-mono text-slate-500">{student.instituteId}</span>,
    },
    {
      id: 'barcodeId',
      label: 'Barcode',
      minWidth: 120,
      render: (student) => <span className="text-xs font-mono text-slate-500">{student.barcodeId || '—'}</span>,
    },
    {
      id: 'status',
      label: 'Attendance Status',
      minWidth: 360,
      align: 'right',
      render: (student) => {
        const currentStatus = localStatuses[student.userId] || '';
        return (
          <div className="flex flex-wrap justify-end gap-1.5">
            {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map(st => {
              const cfg = STATUS_CFG[st];
              const isActive = currentStatus === st;
              return (
                <button
                  key={st}
                  onClick={() => setStudentStatus(student.userId, st)}
                  title={cfg.label}
                  aria-label={`Mark ${student.fullName} as ${cfg.label}`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    isActive
                      ? `${cfg.bg} ${cfg.color}`
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  <span>{cfg.icon}</span>
                  {cfg.label}
                </button>
              );
            })}
          </div>
        );
      },
    },
  ], [localStatuses, setStudentStatus]);

  const monthlyColumns = useMemo<readonly StickyColumn<any>[]>(() => {
    const dateColumns: StickyColumn<any>[] = monthDates.map(d => ({
      id: `d-${d}`,
      label: String(new Date(d + 'T00:00:00').getDate()),
      minWidth: 52,
      align: 'center',
      render: (row) => {
        const st = row.dates[d];
        if (!st) return <span className="text-[10px] text-slate-300">—</span>;
        return (
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold ${
            st === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' : st === 'ABSENT' ? 'bg-red-100 text-red-600' :
            st === 'LATE' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
          }`}>
            {st === 'PRESENT' ? '✓' : st === 'ABSENT' ? '✕' : st === 'LATE' ? 'L' : 'E'}
          </span>
        );
      },
    }));

    return [
      {
        id: 'student',
        label: 'Student',
        minWidth: 220,
        render: (row) => (
          <div className="flex items-center gap-2">
            <Initials name={row.student?.profile?.fullName || '?'} size={7} />
            <div className="min-w-0">
              <p className="font-medium text-xs text-slate-800 truncate max-w-[130px]">{row.student?.profile?.fullName || '-'}</p>
              <p className="text-[10px] text-slate-400 font-mono">{row.student?.profile?.instituteId || '-'}</p>
            </div>
          </div>
        ),
      },
      ...dateColumns,
      { id: 'present', label: 'P', minWidth: 58, align: 'center', render: (row) => <span className="text-xs font-semibold text-emerald-600">{row.counts.PRESENT}</span> },
      { id: 'absent', label: 'A', minWidth: 58, align: 'center', render: (row) => <span className="text-xs font-semibold text-red-600">{row.counts.ABSENT}</span> },
      { id: 'late', label: 'L', minWidth: 58, align: 'center', render: (row) => <span className="text-xs font-semibold text-amber-600">{row.counts.LATE}</span> },
      {
        id: 'percentage',
        label: '%',
        minWidth: 70,
        align: 'center',
        render: (row) => {
          const total = row.counts.PRESENT + row.counts.ABSENT + row.counts.LATE + row.counts.EXCUSED;
          const pct = total > 0 ? Math.round(((row.counts.PRESENT + row.counts.LATE) / total) * 100) : 0;
          return <span className={`text-xs font-bold ${pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>;
        },
      },
    ];
  }, [monthDates]);

  const yearlyColumns = useMemo<readonly StickyColumn<any>[]>(() => {
    const monthColumns: StickyColumn<any>[] = yearActiveMonths.map(m => ({
      id: `m-${m}`,
      label: shortMonth(m),
      minWidth: 70,
      align: 'center',
      render: (row) => {
        const mc = row.months[m];
        if (!mc) return <span className="text-[10px] text-slate-300">—</span>;
        const p = mc.PRESENT || 0;
        const a = mc.ABSENT || 0;
        const l = mc.LATE || 0;
        const mt = p + a + l + (mc.EXCUSED || 0);
        const mp = mt > 0 ? Math.round(((p + l) / mt) * 100) : 0;
        return (
          <div className={`inline-flex flex-col items-center rounded-lg px-1.5 py-0.5 text-[10px] font-semibold ${
            mp >= 75 ? 'bg-emerald-50 text-emerald-700' : mp >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
          }`}>
            <span>{mp}%</span>
            <span className="text-[8px] font-normal opacity-70">{p}/{mt}</span>
          </div>
        );
      },
    }));

    return [
      {
        id: 'student',
        label: 'Student',
        minWidth: 220,
        render: (row) => (
          <div className="flex items-center gap-2">
            <Initials name={row.student?.profile?.fullName || '?'} size={7} />
            <div className="min-w-0">
              <p className="font-medium text-xs text-slate-800 truncate max-w-[130px]">{row.student?.profile?.fullName || '-'}</p>
              <p className="text-[10px] text-slate-400 font-mono">{row.student?.profile?.instituteId || '-'}</p>
            </div>
          </div>
        ),
      },
      ...monthColumns,
      { id: 'totalP', label: 'Total P', minWidth: 78, align: 'center', render: (row) => <span className="text-xs font-semibold text-emerald-600">{row.totalP}</span> },
      { id: 'totalA', label: 'Total A', minWidth: 78, align: 'center', render: (row) => <span className="text-xs font-semibold text-red-600">{row.totalA}</span> },
      {
        id: 'percentage',
        label: '%',
        minWidth: 74,
        align: 'center',
        render: (row) => {
          const pct = row.total > 0 ? Math.round(((row.totalP + row.totalL) / row.total) * 100) : 0;
          return <span className={`text-xs font-bold ${pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>;
        },
      },
    ];
  }, [yearActiveMonths]);

  const paymentColumns = useMemo<readonly StickyColumn<PaymentOverviewStudent>[]>(() => {
    return [
      {
        id: 'student',
        label: 'Student',
        minWidth: 240,
        render: (student) => (
          <div className="flex items-center gap-2">
            <Initials name={student.profile?.fullName || student.email || '?'} size={7} />
            <div className="min-w-0">
              <p className="font-medium text-xs text-slate-800 truncate max-w-[130px]">{student.profile?.fullName || student.email}</p>
              <div className="flex gap-1.5 items-center">
                <span className="text-[10px] text-slate-400 font-mono">{student.profile?.instituteId || '—'}</span>
                {student.profile?.phone && <span className="text-[10px] text-slate-400">• {student.profile.phone}</span>}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'paymentStatus',
        label: 'Payment Status',
        minWidth: 120,
        align: 'center',
        render: (student) => (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${PAY_CFG[student.paymentStatus]?.bg || PAY_CFG.UNPAID.bg} ${PAY_CFG[student.paymentStatus]?.color || PAY_CFG.UNPAID.color}`}>
            {PAY_CFG[student.paymentStatus]?.label || student.paymentStatus}
          </span>
        ),
      },
      {
        id: 'slip',
        label: 'Slip',
        minWidth: 110,
        align: 'center',
        render: (student) => student.slip?.slipUrl ? (
          <a href={student.slip.slipUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600 hover:text-blue-700">View Slip</a>
        ) : <span className="text-xs text-slate-400">No slip</span>,
      },
      {
        id: 'actions',
        label: 'Actions',
        minWidth: 260,
        align: 'right',
        render: (student) => (
          <div className="flex flex-wrap justify-end gap-1.5">
            {(student.paymentStatus === 'UNPAID' || student.paymentStatus === 'LATE') && (
              <button
                onClick={() => setStudentPaymentStatus(student.userId, 'PAID')}
                disabled={!!paymentUpdatingId}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
              >
                {paymentUpdatingId === `${student.userId}:PAID` ? 'Verifying...' : 'Verify'}
              </button>
            )}
            <button
              onClick={() => setStudentPaymentStatus(student.userId, 'LATE')}
              disabled={!!paymentUpdatingId}
              className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 hover:bg-blue-100 disabled:opacity-50"
            >
              {paymentUpdatingId === `${student.userId}:LATE` ? 'Saving...' : 'Mark Late'}
            </button>
            <button
              onClick={() => setStudentPaymentStatus(student.userId, 'UNPAID')}
              disabled={!!paymentUpdatingId}
              className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-semibold border border-red-200 hover:bg-red-100 disabled:opacity-50"
            >
              {paymentUpdatingId === `${student.userId}:UNPAID` ? 'Saving...' : 'Mark Unpaid'}
            </button>
          </div>
        ),
      },
    ];
  }, [paymentUpdatingId, setStudentPaymentStatus]);

  /* ─── Render ───────────────────────────────────── */

  const cardCls = 'bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))]';
  const selectCls = 'px-3 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm text-[hsl(var(--foreground))]';
  const inputCls = 'px-3 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm text-[hsl(var(--foreground))]';
  const adminBasePath = getInstituteAdminPath(instituteId);

  function Initials({ name, size = 9 }: { name: string; size?: number }) {
    const ini = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    return (
      <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0`}>
        <span className={`text-white font-bold ${size <= 7 ? 'text-[9px]' : 'text-[11px]'}`}>{ini}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-slide-in ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <span>{toast.type === 'success' ? '✓' : '✕'}</span> {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Class Attendance</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Mark & track physical class attendance • Barcode scanning</p>
      </div>

      <div className={`${cardCls} p-2 mb-5`}>
        <div className="flex flex-wrap gap-1.5">
          <Link
            to={adminBasePath}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition"
          >
            Dashboard
          </Link>
          <Link
            to={getInstituteAdminPath(instituteId, '/classes')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition"
          >
            Manage Classes
          </Link>
          <Link
            to={getInstituteAdminPath(instituteId, '/class-attendance')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700"
          >
            Advanced Attendance
          </Link>
        </div>
      </div>

      {/* Class Selector + Date Controls */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setLocalStatuses({}); setSavedStatuses({}); setRecentScans([]); }} className={`${selectCls} min-w-[200px]`}>
          <option value="">Select Class...</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.subject ? ` — ${c.subject}` : ''}</option>)}
        </select>

        {tab === 'mark' && (
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className={inputCls} />
        )}
        {tab === 'monthly' && (
          <div className="flex gap-2">
            <select value={viewMonth} onChange={e => setViewMonth(Number(e.target.value))} className={selectCls}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleDateString('en-GB', { month: 'long' })}</option>)}
            </select>
            <select value={viewYear} onChange={e => setViewYear(Number(e.target.value))} className={selectCls}>
              {Array.from({ length: 5 }, (_, i) => { const y = new Date().getFullYear() - 2 + i; return <option key={y} value={y}>{y}</option>; })}
            </select>
          </div>
        )}
        {(tab === 'yearly') && (
          <select value={viewYear} onChange={e => setViewYear(Number(e.target.value))} className={selectCls}>
            {Array.from({ length: 5 }, (_, i) => { const y = new Date().getFullYear() - 2 + i; return <option key={y} value={y}>{y}</option>; })}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 border border-slate-200 w-full">
        {([
          { key: 'monthly' as TabKey, label: 'Monthly' },
          { key: 'yearly' as TabKey, label: 'Yearly' },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>{t.label}</button>
        ))}
      </div>

      {!selectedClassId ? (
        <div className="text-center py-20 text-[hsl(var(--muted-foreground))]">
          <div className="text-4xl mb-3">📚</div>
          <p className="font-medium">Select a class to get started</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'mark' ? (
        /* ═══════ MARK ATTENDANCE TAB ═══════ */
        <div className="space-y-4">
          <div className={`${cardCls} p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{selectedClass?.name}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Attendance Date: {fmtDate(selectedDate)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Total: {students.length}</span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Marked: {students.length - stats.unmarked}</span>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Last ID: {lastMarkedId || '—'}</span>
              </div>
            </div>
          </div>

          <div className={`${cardCls} p-4 space-y-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[hsl(var(--foreground))]">Live Camera Scanner</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">QR and line barcodes are auto-detected and auto-submitted.</p>
              </div>
              <button
                onClick={scanner.active ? scanner.stopCamera : scanner.startCamera}
                className={`px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  scanner.active
                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {scanner.active ? 'Stop Camera' : 'Open Camera'}
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-[hsl(var(--border))] bg-black/90 min-h-[320px]">
              {scanner.active ? (
                <video ref={scanner.videoRef} className="w-full h-[360px] object-cover" muted playsInline />
              ) : (
                <div className="h-[320px] flex items-center justify-center text-sm text-slate-300">
                  Camera is off. Click Open Camera to begin continuous scanning.
                </div>
              )}

              {scanner.active && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-64 max-w-[80%] max-h-[80%] rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.18)] relative overflow-hidden">
                    <div className="absolute left-4 right-4 top-1/2 h-[2px] bg-emerald-300/95 animate-pulse" />
                    <div className="absolute top-4 bottom-4 left-1/2 w-[2px] bg-emerald-300/70" />
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                ref={scanRef}
                type="text"
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleScanMark()}
                placeholder="Barcode / QR value appears here. Press Enter to submit manually."
                className="w-full px-3 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-emerald-300/50"
              />
              <button
                onClick={handleScanMark}
                disabled={!scanInput.trim() || scanState === 'waiting'}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {scanState === 'waiting' ? 'Submitting...' : 'Submit Barcode'}
              </button>
            </div>

            {scanner.error && <p className="text-xs text-red-500">{scanner.error}</p>}

            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-1 rounded-full bg-[hsl(var(--muted)/0.35)] text-[hsl(var(--muted-foreground))]">Flow: camera detect → auto-fill → auto-submit → show student → ready for next</span>
              <span className="px-2 py-1 rounded-full bg-[hsl(var(--muted)/0.35)] text-[hsl(var(--muted-foreground))]">USB scanner also works (fast typing + Enter)</span>
            </div>

            <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
              scanState === 'waiting' ? 'border-amber-200 bg-amber-50 text-amber-700' :
              scanState === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
              scanState === 'error' ? 'border-red-200 bg-red-50 text-red-700' :
              'border-slate-200 bg-slate-50 text-slate-600'
            }`}>
              {scanState === 'waiting' && 'Waiting for server response...'}
              {scanState === 'success' && 'Attendance marked successfully. Ready for next student...'}
              {scanState === 'error' && 'Scan failed. Try scanning again.'}
              {scanState === 'ready' && 'Ready to scan next student.'}
            </div>

            {scanStudent && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
                {scanStudent.avatarUrl ? (
                  <img src={scanStudent.avatarUrl} alt={scanStudent.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-emerald-200 text-emerald-800 font-bold text-lg flex items-center justify-center shrink-0">
                    {(scanStudent.name || '?')[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-emerald-900 truncate">{scanStudent.name}</p>
                  <p className="text-xs text-emerald-700 font-mono truncate">{scanStudent.identifier}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-lg font-black shrink-0">✓</div>
              </div>
            )}

            {recentScans.length > 0 && (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">Recent scans</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {recentScans.slice(0, 8).map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span className="font-medium text-[hsl(var(--foreground))] truncate">{s.name}</span>
                      <span className="text-[hsl(var(--muted-foreground))] font-mono truncate">{s.id}</span>
                      <span className="text-[hsl(var(--muted-foreground))] ml-auto shrink-0">{s.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      ) : tab === 'monthly' ? (
        /* ═══════ MONTHLY VIEW ═══════ */
        <div className={`${cardCls} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{monthLabel(viewYear, viewMonth)} — {selectedClass?.name}</h3>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{monthlySummary.length} students • {monthDates.length} days</span>
          </div>
          {monthlySummary.length === 0 ? (
            <div className="text-center py-12 text-[hsl(var(--muted-foreground))]"><p className="font-medium">No attendance records for this month</p></div>
          ) : (
            <StickyDataTable
              columns={monthlyColumns}
              rows={monthlySummary}
              getRowId={(row) => row.userId}
              tableHeight="calc(100vh - 360px)"
            />
          )}
        </div>

      ) : tab === 'yearly' ? (
        /* ═══════ YEARLY VIEW ═══════ */
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select value={attFilter} onChange={e => setAttFilter(e.target.value as AttendanceFilter)} className={selectCls}>
              <option value="all">All Students</option>
              <option value="absent-last-week">Absent Last Week</option>
              <option value="absent-last-month">Absent Last Month</option>
              <option value="low-attendance">Low Attendance (&lt;50%)</option>
              <option value="never-attended">Never Attended</option>
            </select>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{yearlySummary.length} students • {viewYear}</span>
          </div>

          <div className={`${cardCls} overflow-hidden`}>
            {yearlySummary.length === 0 ? (
              <div className="text-center py-12 text-[hsl(var(--muted-foreground))]"><p className="font-medium">No records found</p></div>
            ) : (
              <StickyDataTable
                columns={yearlyColumns}
                rows={yearlySummary}
                getRowId={(row) => row.userId}
                tableHeight="calc(100vh - 360px)"
              />
            )}
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
            Yearly attendance for {viewYear} • {selectedClass?.name} • Percentage = (Present + Late) / Total
          </p>
        </div>

      ) : tab === 'payments' ? (
        /* ═══════ PAYMENTS TAB ═══════ */
        <div className="space-y-4">
          {/* Filters */}
          <div className={`${cardCls} p-4 space-y-3`}>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={paymentMonthId}
                onChange={e => { setPaymentMonthId(e.target.value); if (e.target.value) loadPaymentOverview(paymentClassRef.current, e.target.value); }}
                className={`${selectCls} min-w-[220px]`}
              >
                <option value="">Select Month...</option>
                {paymentMonths.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by student name, ID or barcode..."
                className={`${inputCls} w-full sm:w-72`} />
              {(search || payFilter !== 'all') && (
                <button
                  onClick={() => { setSearch(''); setPayFilter('all'); }}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Clear Filters
                </button>
              )}
              <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto">{filteredPayStudents.length} student{filteredPayStudents.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200 w-full overflow-x-auto">
              {([
                { key: 'all' as const, label: 'All', count: paymentCounts.all },
                { key: 'PAID' as const, label: 'Paid', count: paymentCounts.PAID },
                { key: 'LATE' as const, label: 'Late', count: paymentCounts.LATE },
                { key: 'PENDING' as const, label: 'Pending', count: paymentCounts.PENDING },
                { key: 'UNPAID' as const, label: 'Unpaid', count: paymentCounts.UNPAID },
              ]).map(item => (
                <button
                  key={item.key}
                  onClick={() => setPayFilter(item.key)}
                  className={`flex-1 min-w-[96px] px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                    payFilter === item.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    payFilter === item.key ? 'bg-slate-100 text-slate-700' : 'bg-white/70 text-slate-500 border border-slate-200'
                  }`}>
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {!paymentMonthId ? (
            <div className="text-center py-12 text-[hsl(var(--muted-foreground))]"><p className="font-medium">Select a month to view payment statuses</p></div>
          ) : paymentLoading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-3 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" /></div>
          ) : paymentError ? (
            <div className="text-center py-12 text-red-600"><p className="font-medium">{paymentError}</p></div>
          ) : !paymentOverview ? (
            <div className="text-center py-12 text-[hsl(var(--muted-foreground))]"><p className="font-medium">No payment data found</p></div>
          ) : (
            <div className={`${cardCls} overflow-hidden`}>
              {filteredPayStudents.length === 0 ? (
                <div className="text-center py-12 text-[hsl(var(--muted-foreground))]"><p className="font-medium">No students found</p></div>
              ) : (
                <StickyDataTable
                  columns={paymentColumns}
                  rows={filteredPayStudents}
                  getRowId={(row) => row.userId}
                  tableHeight="calc(100vh - 380px)"
                />
              )}
            </div>
          )}
          <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
            Payment status for {selectedClass?.name} • {selectedClass?.monthlyFee ? `Rs. ${selectedClass.monthlyFee}/month` : 'No fee set'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
