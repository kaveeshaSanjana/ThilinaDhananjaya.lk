import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../lib/api';
import { getInstituteAdminPath } from '../../lib/instituteRoutes';

type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

interface ClassItem {
  id: string;
  name: string;
  subject?: string;
}

interface ClassStudentItem {
  userId: string;
  fullName: string;
  instituteId: string;
  barcodeId?: string | null;
  avatarUrl?: string | null;
}

interface MarkedStudent {
  userId?: string;
  name: string;
  identifier: string;
  instituteId?: string;
  barcodeId?: string;
  avatarUrl?: string;
}

function toDateStr(date: Date) {
  return date.toISOString().split('T')[0];
}

function normalizeIdentifier(raw: string) {
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

  return value;
}

function readText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function pickText(...values: unknown[]) {
  for (const value of values) {
    const text = readText(value);
    if (text) return text;
  }
  return '';
}

function normalizeClassStudentItem(raw: unknown): ClassStudentItem | null {
  if (!raw || typeof raw !== 'object') return null;

  const row = raw as Record<string, unknown>;
  const user = row.user && typeof row.user === 'object' ? row.user as Record<string, unknown> : undefined;
  const profile = row.profile && typeof row.profile === 'object'
    ? row.profile as Record<string, unknown>
    : user?.profile && typeof user.profile === 'object'
      ? user.profile as Record<string, unknown>
      : undefined;

  const userId = pickText(row.userId, user?.id, row.id, profile?.userId);
  if (!userId) return null;

  const fullName = pickText(row.fullName, profile?.fullName, user?.name, user?.email, userId);
  const instituteId = pickText(row.instituteId, profile?.instituteId);
  const barcodeId = pickText(row.barcodeId, profile?.barcodeId) || null;
  const avatarUrl = pickText(row.avatarUrl, profile?.avatarUrl) || null;

  return {
    userId,
    fullName,
    instituteId: instituteId || '-',
    barcodeId,
    avatarUrl,
  };
}

function findStudentByIdentifier(identifier: string, students: ClassStudentItem[]) {
  const token = identifier.trim().toLowerCase();
  if (!token) return undefined;

  return students.find((student) => {
    const barcode = (student.barcodeId || '').trim().toLowerCase();
    const institute = (student.instituteId || '').trim().toLowerCase();
    const userId = (student.userId || '').trim().toLowerCase();
    return token === barcode || token === institute || token === userId;
  });
}

export default function AdminMarkAttendanceExternalDevice() {
  const { instituteId } = useParams<{ instituteId: string }>();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [status, setStatus] = useState<AttStatus>('PRESENT');
  const [rfidInput, setRfidInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [clockText, setClockText] = useState(new Date().toLocaleTimeString('en-GB'));
  const [lastMarkedId, setLastMarkedId] = useState('');
  const [markedStudent, setMarkedStudent] = useState<MarkedStudent | null>(null);
  const [classStudents, setClassStudents] = useState<ClassStudentItem[]>([]);
  const [studentsById, setStudentsById] = useState<Record<string, ClassStudentItem>>({});
  const [studentFilter, setStudentFilter] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastMarkedStorageKey = useMemo(
    () => (selectedClassId ? `mark-attendance:external:last:${selectedClassId}:${selectedDate}` : ''),
    [selectedClassId, selectedDate],
  );

  useEffect(() => {
    const loadClasses = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/classes');
        const rows = (data || []) as ClassItem[];
        setClasses(rows);
        if (rows.length > 0) setSelectedClassId(rows[0].id);
      } finally {
        setLoading(false);
      }
    };

    void loadClasses();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockText(new Date().toLocaleTimeString('en-GB'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedClassId) {
      setClassStudents([]);
      setStudentsById({});
      return;
    }

    api.get(`/attendance/class-attendance/class/${selectedClassId}/students`)
      .then((response) => {
        const payload = response.data as unknown;
        const rows = Array.isArray(payload)
          ? payload
          : payload && typeof payload === 'object' && Array.isArray((payload as { students?: unknown[] }).students)
            ? (payload as { students: unknown[] }).students
            : [];
        const normalizedRows = rows
          .map((item) => normalizeClassStudentItem(item))
          .filter((item): item is ClassStudentItem => Boolean(item));
        const index: Record<string, ClassStudentItem> = {};
        normalizedRows.forEach((item) => {
          if (item?.userId) index[item.userId] = item;
        });
        setClassStudents(normalizedRows);
        setStudentsById(index);
      })
      .catch(() => {
        setClassStudents([]);
        setStudentsById({});
      });
  }, [selectedClassId]);

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
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    const identifier = normalizeIdentifier(rfidInput);
    if (!identifier || !selectedClassId) return;
    const matchedStudentByScan = findStudentByIdentifier(identifier, classStudents);

    if (identifier === lastMarkedId) {
      setError(`Duplicate ignored: ${identifier}`);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { data } = await api.post('/attendance/class-attendance/mark', {
        classId: selectedClassId,
        identifier,
        date: selectedDate,
        status,
        method: 'external_device',
      });

      const studentMeta = (data?.userId ? studentsById[data.userId] : undefined) || matchedStudentByScan;
      const profile = data?.user?.profile;
      const name = profile?.fullName || studentMeta?.fullName || identifier;
      const avatarUrl = profile?.avatarUrl || studentMeta?.avatarUrl || '';
      const instituteUserId = studentMeta?.instituteId || profile?.instituteId || '';
      const barcodeId = studentMeta?.barcodeId || profile?.barcodeId || '';

      setLastMarkedId(identifier);
      setMarkedStudent({
        userId: data?.userId || studentMeta?.userId || matchedStudentByScan?.userId || '',
        name,
        identifier,
        instituteId: instituteUserId,
        barcodeId,
        avatarUrl,
      });
      setRfidInput('');
      inputRef.current?.focus();

      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        setMarkedStudent(null);
      }, 2000);
    } catch (submitError: any) {
      setError(submitError?.response?.data?.message || 'Failed to mark attendance');
    } finally {
      setSubmitting(false);
    }
  }, [classStudents, lastMarkedId, rfidInput, selectedClassId, selectedDate, status, studentsById]);

  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const adminBase = getInstituteAdminPath(instituteId);
  const filteredStudents = useMemo(() => {
    const query = studentFilter.trim().toLowerCase();
    if (!query) return classStudents;
    return classStudents.filter((student) => {
      const fields = [
        student.fullName,
        student.instituteId,
        student.barcodeId || '',
        student.userId,
      ];
      return fields.some((field) => field.toLowerCase().includes(query));
    });
  }, [classStudents, studentFilter]);

  return (
    <div className="min-h-screen px-3 py-4 md:px-6 md:py-6 bg-[hsl(var(--background))]">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={getInstituteAdminPath(instituteId, '/mark-attendance')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Mark Attendance - External Device</h1>
          <Link
            to={adminBase}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold"
          >
            Dashboard
          </Link>
        </div>

        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-semibold">Current selection</p>
          <p className="text-sm font-semibold text-[hsl(var(--foreground))] mt-1">{selectedClass?.name || 'Select class'}</p>
        </div>

        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden">
          <div className="grid grid-cols-2 border-b border-[hsl(var(--border))]">
            <div className="px-4 py-3 text-center border-r border-[hsl(var(--border))]">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Date</p>
              <p className="text-2xl font-bold text-[hsl(var(--foreground))] mt-1">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Time</p>
              <p className="text-2xl font-bold text-[hsl(var(--foreground))] mt-1">{clockText}</p>
            </div>
          </div>

          <div className="grid gap-0 md:grid-cols-2">
            <div className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-[hsl(var(--border))] flex items-center justify-center">
              {markedStudent ? (
                <div className="w-full max-w-xs rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                  {markedStudent.avatarUrl ? (
                    <img src={markedStudent.avatarUrl} alt={markedStudent.name} className="w-24 h-24 rounded-2xl object-cover mx-auto" />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-emerald-200 text-emerald-800 text-3xl font-bold flex items-center justify-center mx-auto">
                      {(markedStudent.name || '?')[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <p className="text-base font-bold text-emerald-900 mt-3 truncate">{markedStudent.name}</p>
                  <p className="text-xs font-mono text-emerald-700 truncate">{markedStudent.identifier}</p>
                  <p className="text-[11px] text-emerald-700/90 truncate">
                    Institute ID: <span className="font-mono">{markedStudent.instituteId || '-'}</span>
                  </p>
                  <p className="text-[11px] text-emerald-700/90 truncate">
                    Barcode ID: <span className="font-mono">{markedStudent.barcodeId || '-'}</span>
                  </p>
                  <p className="text-[11px] text-emerald-700/90 truncate">
                    User ID: <span className="font-mono">{markedStudent.userId || '-'}</span>
                  </p>
                  <p className="text-xs text-emerald-700 font-semibold mt-2">Marked as {status}</p>
                </div>
              ) : (
                <div className="w-full max-w-xs aspect-square rounded-2xl border-[3px] border-red-400 flex items-center justify-center">
                  <svg className="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0115 0A17.933 17.933 0 0112 21.75a17.933 17.933 0 01-7.5-1.632z" />
                  </svg>
                </div>
              )}
            </div>

            <div className="p-5 md:p-7 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">RFID ID</label>
                <input
                  ref={inputRef}
                  value={rfidInput}
                  onChange={(event) => setRfidInput(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && void handleSubmit()}
                  placeholder="Scan or enter RFID ID..."
                  className="mt-1 w-full px-3 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Status</label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as AttStatus)}
                  className="mt-1 w-full px-3 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm"
                >
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late</option>
                  <option value="ABSENT">Absent</option>
                  <option value="EXCUSED">Excused</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Event</label>
                <select
                  value={selectedClassId}
                  onChange={(event) => setSelectedClassId(event.target.value)}
                  className="mt-1 w-full px-3 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm"
                >
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}{item.subject ? ` - ${item.subject}` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="mt-1 w-full px-3 py-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm"
                />
              </div>

              <button
                onClick={() => void handleSubmit()}
                disabled={!rfidInput.trim() || submitting || loading}
                className="w-full py-3 rounded-xl bg-blue-500 text-white font-semibold text-lg disabled:opacity-50 hover:bg-blue-600 transition"
              >
                {submitting ? 'Marking...' : 'Mark Attendance'}
              </button>

              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}

              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Last marked ID: <span className="font-mono">{lastMarkedId || '—'}</span></p>
            </div>
          </div>
        </div>

        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Class Students ({filteredStudents.length}/{classStudents.length})
            </p>
            <input
              type="text"
              value={studentFilter}
              onChange={(event) => setStudentFilter(event.target.value)}
              placeholder="Filter by name, institute ID, barcode ID, or user ID"
              className="w-full md:w-80 px-3 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-xs"
            />
          </div>

          {classStudents.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No linked students found for this class.</p>
          ) : filteredStudents.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No students match this filter.</p>
          ) : (
            <div className="max-h-64 overflow-auto rounded-xl border border-[hsl(var(--border))]">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Student Name</th>
                    <th className="px-3 py-2 text-left font-semibold">Institute User ID</th>
                    <th className="px-3 py-2 text-left font-semibold">Barcode ID</th>
                    <th className="px-3 py-2 text-left font-semibold">User ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.userId} className="border-t border-[hsl(var(--border))]">
                      <td className="px-3 py-2 font-medium text-[hsl(var(--foreground))]">{student.fullName || '-'}</td>
                      <td className="px-3 py-2 font-mono text-[hsl(var(--foreground))]">{student.instituteId || '-'}</td>
                      <td className="px-3 py-2 font-mono text-[hsl(var(--foreground))]">{student.barcodeId || '-'}</td>
                      <td className="px-3 py-2 font-mono text-[hsl(var(--muted-foreground))]">{student.userId || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  );
}
