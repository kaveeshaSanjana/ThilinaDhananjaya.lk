import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../lib/api';
import { getInstituteAdminPath, getInstitutePath } from '../lib/instituteRoutes';

interface ScanPopup {
  name: string;
  avatarUrl: string;
  identifier: string;
}

interface RecentScanItem {
  identifier: string;
  name: string;
  time: string;
  ok: boolean;
  message?: string;
  avatarUrl?: string;
}

interface ScannerApi {
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  error: string;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

const POPUP_SECONDS_KEY = 'attendanceQrPopupSeconds';

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeScanValue(rawValue: string): string {
  const value = rawValue.trim();
  if (!value) return '';

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      const keys = ['barcode', 'barcodeId', 'identifier', 'studentId', 'instituteId', 'id'];
      for (const key of keys) {
        const v = parsed[key];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
    }
  } catch {
    // Not JSON payload; continue.
  }

  try {
    const url = new URL(value);
    const keys = ['barcode', 'barcodeId', 'identifier', 'studentId', 'instituteId', 'id', 'code'];
    for (const key of keys) {
      const v = url.searchParams.get(key);
      if (v && v.trim()) return v.trim();
    }
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const last = decodeURIComponent(segments[segments.length - 1] || '').trim();
      if (last) return last;
    }
  } catch {
    // Not URL payload; keep raw value.
  }

  return value;
}

function readPopupSecondsSetting() {
  const raw = localStorage.getItem(POPUP_SECONDS_KEY);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 2;
  const rounded = Math.round(parsed);
  if (rounded < 1) return 1;
  if (rounded > 12) return 12;
  return rounded;
}

function useQrScanner(onScan: (raw: string) => void): ScannerApi {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const keyBufferRef = useRef('');
  const keyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmitRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });

  const [active, setActive] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    detectorRef.current = null;
    setActive(false);
  }, []);

  const detectLoop = useCallback(async () => {
    const video = videoRef.current;
    if (video && detectorRef.current && video.readyState >= 2) {
      try {
        const barcodes = await detectorRef.current.detect(video);
        const code = barcodes?.find((item: any) => typeof item?.rawValue === 'string' && item.rawValue.trim())?.rawValue;
        if (typeof code === 'string') {
          const now = Date.now();
          const normalized = code.trim();
          if (normalized && (normalized !== lastEmitRef.current.value || now - lastEmitRef.current.at > 900)) {
            lastEmitRef.current = { value: normalized, at: now };
            onScan(normalized);
          }
        }
      } catch {
        // Ignore frame-level decode errors and continue scanning.
      }
    }

    rafRef.current = window.requestAnimationFrame(() => {
      void detectLoop();
    });
  }, [onScan]);

  const startCamera = useCallback(async () => {
    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      setError('Camera QR scan is not supported in this browser. Use Chrome or Edge, or use a USB scanner.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      detectorRef.current = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      setError('');
      setActive(true);

      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = window.requestAnimationFrame(() => {
        void detectLoop();
      });
    } catch {
      setError('Unable to start camera. Please allow camera permission.');
      stopCamera();
    }
  }, [detectLoop, stopCamera]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      if (event.key === 'Enter') {
        const value = keyBufferRef.current.trim();
        if (value.length >= 3) onScan(value);
        keyBufferRef.current = '';
        return;
      }

      if (event.key.length === 1) {
        keyBufferRef.current += event.key;
        if (keyTimerRef.current) window.clearTimeout(keyTimerRef.current);
        keyTimerRef.current = setTimeout(() => {
          keyBufferRef.current = '';
        }, 220);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (keyTimerRef.current) window.clearTimeout(keyTimerRef.current);
    };
  }, [onScan]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (keyTimerRef.current) window.clearTimeout(keyTimerRef.current);
    };
  }, [stopCamera]);

  return { videoRef, active, error, startCamera, stopCamera };
}

export default function ClassPhysicalAttendanceQrPage() {
  const { classId, instituteId } = useParams<{ classId: string; instituteId: string }>();

  const [selectedDate, setSelectedDate] = useState(toLocalDateStr(new Date()));
  const [classData, setClassData] = useState<{ name?: string; instituteId?: string; institute?: { id?: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('Ready to scan QR');
  const [popupSeconds, setPopupSeconds] = useState<number>(() => readPopupSecondsSetting());
  const [showSettings, setShowSettings] = useState(false);
  const [lastScannedId, setLastScannedId] = useState('');
  const [scanPopup, setScanPopup] = useState<ScanPopup | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScanItem[]>([]);
  const [stats, setStats] = useState({ markedCount: 0, enrolledCount: 0 });

  const inFlightRef = useRef(false);

  const lastScanKey = useMemo(() => {
    return classId ? `attendanceQrLastScan:${classId}:${selectedDate}` : '';
  }, [classId, selectedDate]);

  const refreshStats = useCallback(async () => {
    if (!classId) return;
    try {
      const [attendanceRes, studentsRes] = await Promise.all([
        api.get(`/attendance/class-attendance/class/${classId}/date/${selectedDate}`),
        api.get(`/attendance/class-attendance/class/${classId}/students`),
      ]);
      const attendanceRows = (attendanceRes.data || []) as unknown[];
      const studentRows = (studentsRes.data || []) as unknown[];
      setStats({
        markedCount: attendanceRows.length,
        enrolledCount: studentRows.length,
      });
    } catch {
      // Keep existing stats on fetch failure.
    }
  }, [classId, selectedDate]);

  const addRecentScan = useCallback((entry: RecentScanItem) => {
    setRecentScans((prev) => [entry, ...prev.slice(0, 24)]);
  }, []);

  const handleScannedRaw = useCallback(async (rawValue: string) => {
    if (!classId) return;

    const incomingId = normalizeScanValue(rawValue);
    if (!incomingId) return;

    if (incomingId === lastScannedId) {
      setStatusText(`Duplicate scan ignored: ${incomingId}`);
      return;
    }

    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setStatusText(`Marking attendance for ${incomingId}...`);
    setError('');

    try {
      let data: any;

      try {
        const barcodeRes = await api.post('/attendance/class-attendance/mark/by-barcode', {
          classId,
          barcode: incomingId,
          date: selectedDate,
          status: 'PRESENT',
        });
        data = barcodeRes.data;
      } catch {
        const fallbackRes = await api.post('/attendance/class-attendance/mark', {
          classId,
          identifier: incomingId,
          date: selectedDate,
          status: 'PRESENT',
          method: 'qr',
        });
        data = fallbackRes.data;
      }

      const profile = data?.user?.profile;
      const displayName = profile?.fullName || data?.user?.name || incomingId;
      const avatarUrl = profile?.avatarUrl || '';

      setLastScannedId(incomingId);
      setStatusText(`Marked: ${displayName}`);
      setScanPopup({ name: displayName, avatarUrl, identifier: incomingId });
      addRecentScan({
        identifier: incomingId,
        name: displayName,
        time: new Date().toLocaleTimeString('en-GB'),
        ok: true,
        avatarUrl,
      });
      void refreshStats();
    } catch (apiError: any) {
      const message = apiError?.response?.data?.message || 'Student not found for scanned QR';
      setError(message);
      setStatusText('Scan failed');
      addRecentScan({
        identifier: incomingId,
        name: 'Unknown Student',
        time: new Date().toLocaleTimeString('en-GB'),
        ok: false,
        message,
      });
    } finally {
      inFlightRef.current = false;
    }
  }, [addRecentScan, classId, lastScannedId, refreshStats, selectedDate]);

  const scanner = useQrScanner(handleScannedRaw);

  useEffect(() => {
    if (!classId) return;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const classRes = await api.get(`/classes/${classId}`);
        setClassData(classRes.data?.class ?? classRes.data ?? null);
      } catch (loadError: any) {
        setError(loadError?.response?.data?.message || 'Failed to load class details');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [classId, refreshStats]);

  useEffect(() => {
    if (!lastScanKey) return;
    setLastScannedId(localStorage.getItem(lastScanKey) || '');
  }, [lastScanKey]);

  useEffect(() => {
    if (!lastScanKey) return;
    if (lastScannedId) localStorage.setItem(lastScanKey, lastScannedId);
    else localStorage.removeItem(lastScanKey);
  }, [lastScanKey, lastScannedId]);

  useEffect(() => {
    localStorage.setItem(POPUP_SECONDS_KEY, String(popupSeconds));
  }, [popupSeconds]);

  useEffect(() => {
    if (!scanPopup) return;
    const timeoutId = window.setTimeout(() => {
      setScanPopup(null);
    }, popupSeconds * 1000);
    return () => window.clearTimeout(timeoutId);
  }, [popupSeconds, scanPopup]);

  const resolvedInstituteId = instituteId || classData?.instituteId || classData?.institute?.id || null;
  const mkPath = useCallback((suffix: string) => getInstitutePath(resolvedInstituteId, suffix), [resolvedInstituteId]);
  const adminDashboardPath = getInstituteAdminPath(resolvedInstituteId);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-[3px] border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          to={mkPath(`/classes/${classId}/physical-attendance`)}
          className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Physical Attendance
        </Link>

        <Link
          to={adminDashboardPath}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
        >
          Institute Dashboard
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{classData?.name || 'Selected Class'}</p>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">QR Attendance Scanner</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">QR-only fast marking mode with duplicate-scan protection</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="px-3 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm"
          />
          <button
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            className="px-3 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
          >
            Settings
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 grid gap-3 md:grid-cols-[12rem_1fr_auto] items-end">
          <div>
            <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1">Popup Hide Time (seconds)</label>
            <input
              type="number"
              min={1}
              max={12}
              value={popupSeconds}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                const clamped = Math.max(1, Math.min(12, Math.round(next)));
                setPopupSeconds(clamped);
              }}
              className="w-full px-3 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm"
            />
          </div>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            Default is 2 seconds. This controls how long the green success popup stays visible after each successful scan.
          </div>
          <button
            type="button"
            onClick={() => setLastScannedId('')}
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
          >
            Clear Last ID
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold text-emerald-700">Marked Today</p>
          <p className="text-2xl font-bold text-emerald-800">{stats.markedCount}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-xs font-semibold text-blue-700">Enrolled Students</p>
          <p className="text-2xl font-bold text-blue-800">{stats.enrolledCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-700">Last Scanned ID</p>
          <p className="text-sm font-mono font-semibold text-slate-800 truncate">{lastScannedId || '—'}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">Scan Zone</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Camera scans QR codes continuously. USB scanners are also supported.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={scanner.active ? scanner.stopCamera : scanner.startCamera}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                scanner.active
                  ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {scanner.active ? 'Stop Camera' : 'Start Camera'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] overflow-hidden">
          {scanner.active ? (
            <>
              <video ref={scanner.videoRef} className="w-full max-h-[420px] bg-black object-cover" muted playsInline />
              <div className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted)/0.35)]">
                Point the camera at a QR code. Scan triggers automatically.
              </div>
            </>
          ) : (
            <div className="py-14 text-center text-[hsl(var(--muted-foreground))] text-sm">
              Camera is off. Click Start Camera to begin scanning.
            </div>
          )}
        </div>

        {scanner.error && (
          <p className="text-xs text-red-600">{scanner.error}</p>
        )}

        <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
          {statusText}
        </div>
      </div>

      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <h3 className="text-sm font-bold text-[hsl(var(--foreground))] mb-2">Recent Scans</h3>
        {recentScans.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">No scans yet.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {recentScans.map((scan, index) => (
              <div
                key={`${scan.identifier}-${scan.time}-${index}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${scan.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}
              >
                {scan.avatarUrl ? (
                  <img src={scan.avatarUrl} alt={scan.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-sm font-bold ${scan.ok ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>
                    {(scan.name || '?')[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{scan.name}</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] font-mono truncate">{scan.identifier}</p>
                  {scan.message && <p className="text-[11px] text-red-600 truncate">{scan.message}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-bold ${scan.ok ? 'text-emerald-700' : 'text-red-700'}`}>{scan.ok ? 'Success' : 'Failed'}</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{scan.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {scanPopup && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 w-full max-w-md">
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 shadow-xl px-4 py-3 flex items-center gap-3">
            {scanPopup.avatarUrl ? (
              <img src={scanPopup.avatarUrl} alt={scanPopup.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-emerald-200 text-emerald-800 flex items-center justify-center text-lg font-bold shrink-0">
                {(scanPopup.name || '?')[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-emerald-900 truncate">{scanPopup.name}</p>
              <p className="text-xs text-emerald-700 font-mono truncate">{scanPopup.identifier}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-lg font-black shrink-0">
              ✓
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
