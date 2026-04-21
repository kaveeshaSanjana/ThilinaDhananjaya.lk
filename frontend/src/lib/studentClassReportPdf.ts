import api from './api';
import easyEnglishPdfHeader from '../assets/easy-english-pdf-header.png';

export type RecordingReportMode = 'SUMMARY' | 'FULL';

export interface StudentClassReportPayload {
  /**
   * Optional letterhead image shown full-width at the top of page 1 only.
   * Recommended size: 2480 × 350 px (210 mm × ~30 mm at 300 dpi).
   * Aspect ratio is preserved; height is capped at 45 mm.
   */
  letterheadUrl?: string | null;
  classInfo: {
    id?: string;
    name?: string;
    subject?: string | null;
  };
  student: {
    userId: string;
    fullName: string;
    instituteId?: string | null;
    email?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
    paymentType?: string | null;
    effectiveMonthlyFee?: number | null;
  };
  /** Custom footer text shown on every page. */
  footer?: {
    /** Left column — e.g. "thilinadhananjaya.lk | 0712525472" */
    left?: string | null;
    /** Centre column — e.g. "SurakshaLMS" */
    center?: string | null;
  } | null;
  options: {
    includePayments: boolean;
    includePhysicalAttendance: boolean;
    includeRecordingAttendance: boolean;
    recordingMode: RecordingReportMode;
  };
  payments?: {
    rows: Array<{
      label: string;
      status: string;
      slipCount: number;
      latestSlipStatus?: string | null;
    }>;
    paidCount: number;
    pendingCount: number;
    unpaidCount: number;
  };
  physicalAttendance?: {
    summary: {
      total: number;
      present: number;
      late: number;
      absent: number;
      excused: number;
      percentage: number;
    };
    rows: Array<{
      date: string;
      session: string;
      sessionTime: string;
      status: string;
    }>;
  };
  recordingAttendance?: {
    summaryRows: Array<{
      title: string;
      month: string;
      sessions: number;
      watchedSec: number;
      lastWatchedAt?: string | null;
    }>;
    sessionRows: Array<{
      title: string;
      startedAt?: string;
      endedAt?: string | null;
      watchedSec: number;
      status: string;
    }>;
  };
}

// ─── Sinhala text handling ────────────────────────────────────────────────────

const SINHALA_FONT_URL =
  'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansSinhala/NotoSansSinhala-Regular.ttf';
const SINHALA_FONT_NAME = 'NotoSansSinhala';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function registerSinhalaFont(doc: any): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(SINHALA_FONT_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return false;
    const fontBuffer = await response.arrayBuffer();
    const base64Font = arrayBufferToBase64(fontBuffer);
    const fileName = `${SINHALA_FONT_NAME}.ttf`;
    let alreadyRegistered = false;
    try {
      alreadyRegistered = Boolean((doc as any).getFileFromVFS?.(fileName));
    } catch {
      alreadyRegistered = false;
    }
    if (!alreadyRegistered) {
      doc.addFileToVFS(fileName, base64Font);
      doc.addFont(fileName, SINHALA_FONT_NAME, 'normal');
      doc.addFont(fileName, SINHALA_FONT_NAME, 'bold');
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Sinhala heading labels ────────────────────────────────────────────────────

const SI = {
  month:          'Month / මාසය',
  status:         'Status / තත්ත්වය',
  slips:          'Slips / රිසිට්පත්',
  latestSlip:     'Latest Slip / අවසන් රිසිට්පත',
  date:           'Date / දිනය',
  session:        'Session / සැසිය',
  time:           'Time / වේලාව',
  total:          'Total / මුළු',
  present:        'Present / පැමිණි',
  late:           'Late / ප්‍රමාද',
  absent:         'Absent / නොපැමිණි',
  excused:        'Excused / අවසර',
  attendancePct:  'Attendance % / පැමිණීම %',
  recordingTitle: 'Recording / පටිගත කිරීම',
  sessions:       'Sessions / සැසි',
  watchedTime:    'Watched Time / නැරඹූ කාලය',
  lastWatch:      'Last Watch / අවසන් නැරඹීම',
  started:        'Started / ආරම්භය',
  ended:          'Ended / අවසානය',
  watched:        'Watched / නැරඹූ',
} as const;

const SI_EN = {
  month:          'Month',
  status:         'Status',
  slips:          'Slips',
  latestSlip:     'Latest Slip',
  date:           'Date',
  session:        'Session',
  time:           'Time',
  total:          'Total',
  present:        'Present',
  late:           'Late',
  absent:         'Absent',
  excused:        'Excused',
  attendancePct:  'Attendance %',
  recordingTitle: 'Recording',
  sessions:       'Sessions',
  watchedTime:    'Watched Time',
  lastWatch:      'Last Watch',
  started:        'Started',
  ended:          'Ended',
  watched:        'Watched',
} as const;

// ─── Formatters ────────────────────────────────────────────────────────────────

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date}  ${time}`;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Formats a session time string that may arrive as "HH:MM", "HH:MM:SS", or full ISO.
 * Returns a clean "HH:MM" string, or "—" when the value is empty or midnight (00:00),
 * which typically signals that no actual session time was recorded in the DB.
 */
function fmtSessionTime(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '' || raw === '—') return '—';
  const s = raw.trim();

  // Short time pattern: "HH:MM" or "HH:MM:SS"
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(':');
    const display = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    return display === '00:00' ? '—' : display;
  }

  // Full ISO datetime — extract time part
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return safeText(s); // unknown format — pass through
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return time === '00:00' ? '—' : time;
}

/**
 * Formats a date that may arrive as "YYYY-MM-DD" (plain date from the DB)
 * or a full ISO string. Always returns "DD Mon YYYY".
 * Parses plain dates as local midnight to avoid UTC timezone shifts.
 */
function fmtAttendanceDate(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '' || raw === '—') return '—';
  const s = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return fmtDate(s);
}

function normalizeText(value?: string | null): string {
  return String(value || '')
    .replace(/â€"|â€"/g, '-')
    .replace(/â€œ|â€/g, '"')
    .replace(/â€˜|â€™/g, "'")
    .replace(/Â/g, '');
}

function safeText(value: string | null | undefined, fallback = '—'): string {
  const cleaned = normalizeText(value).trim();
  return cleaned || fallback;
}

function cleanFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

function initialsFromName(name: string): string {
  return (
    name
      .split(' ')
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'ST'
  );
}

function resolveAssetUrl(rawUrl?: string): string {
  const value = (rawUrl || '').trim();
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith('//')) return `${window.location.protocol}${value}`;
  const apiBase = typeof api.defaults.baseURL === 'string' ? api.defaults.baseURL : '';
  let origin = window.location.origin;
  if (/^https?:\/\//i.test(apiBase)) {
    try { origin = new URL(apiBase).origin; } catch { /* keep fallback */ }
  }
  if (value.startsWith('/')) return `${origin}${value}`;
  return `${origin}/${value.replace(/^\/+/, '')}`;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to convert blob to data URL'));
    };
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}

async function loadAvatarImage(rawUrl?: string | null): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  const resolved = resolveAssetUrl(rawUrl || '');
  if (!resolved) return null;
  try {
    if (/^data:image\//i.test(resolved)) {
      return { dataUrl: resolved, format: resolved.toLowerCase().startsWith('data:image/png') ? 'PNG' : 'JPEG' };
    }
    const targetUrl = new URL(resolved, window.location.origin);
    if (targetUrl.origin !== window.location.origin) return null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(targetUrl.toString(), {
      credentials: 'include',
      signal: controller.signal,
      headers: { Accept: 'image/*' },
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    const dataUrl = await blobToDataUrl(blob);
    return { dataUrl, format: blob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG' };
  } catch {
    return null;
  }
}

// ─── Status badge colours ───────────────────────────────────────────────────

type RGB = [number, number, number];

function paymentStatusColors(raw: string | null | undefined): { bg: RGB; text: RGB; label: string } {
  const v = (raw || '').trim().toUpperCase();
  if (v === 'PAID' || v === 'VERIFIED')   return { bg: [220, 252, 231], text: [22, 101, 52],  label: 'Paid'    };
  if (v === 'PENDING')                    return { bg: [254, 249, 195], text: [133, 77, 14],  label: 'Pending' };
  if (v === 'LATE')                       return { bg: [255, 237, 213], text: [154, 52, 18],  label: 'Late'    };
  if (v === 'UNPAID' || v === 'REJECTED') return { bg: [254, 226, 226], text: [153, 27, 27],  label: 'Unpaid'  };
  return { bg: [241, 245, 249], text: [71, 85, 105], label: v || '—' };
}

function attendanceStatusColors(raw: string | null | undefined): { bg: RGB; text: RGB; label: string } {
  const v = (raw || '').trim().toUpperCase();
  if (v === 'PRESENT') return { bg: [220, 252, 231], text: [22, 101, 52],  label: 'Present' };
  if (v === 'LATE')    return { bg: [255, 237, 213], text: [154, 52, 18],  label: 'Late'    };
  if (v === 'ABSENT')  return { bg: [254, 226, 226], text: [153, 27, 27],  label: 'Absent'  };
  if (v === 'EXCUSED') return { bg: [224, 242, 254], text: [14, 116, 163], label: 'Excused' };
  return { bg: [241, 245, 249], text: [71, 85, 105], label: v || '—' };
}

function recordingStatusColors(raw: string | null | undefined): { bg: RGB; text: RGB; label: string } {
  const v = (raw || '').trim().toUpperCase();
  if (v === 'WATCHED' || v === 'COMPLETED')     return { bg: [220, 252, 231], text: [22, 101, 52], label: 'Watched'   };
  if (v === 'PARTIAL')                          return { bg: [255, 237, 213], text: [154, 52, 18], label: 'Partial'   };
  if (v === 'NOT_WATCHED' || v === 'UNWATCHED') return { bg: [254, 226, 226], text: [153, 27, 27], label: 'Unwatched' };
  return { bg: [241, 245, 249], text: [71, 85, 105], label: v || '—' };
}

// ─── Exports ────────────────────────────────────────────────────────────────

export function createStudentClassReportFileName(studentName: string, instituteId?: string | null): string {
  const suffix = instituteId ? `${studentName}-${instituteId}` : studentName;
  return cleanFileName(`Student-Report-${suffix}.pdf`);
}

export async function buildStudentClassReportPdf(payload: StudentClassReportPayload): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();   // 210
  const PH = doc.internal.pageSize.getHeight();  // 297

  const sinhalaLoaded = await registerSinhalaFont(doc);
  const headFont = sinhalaLoaded ? SINHALA_FONT_NAME : 'helvetica';

  // ── Palette ──────────────────────────────────────────────────────────────
  const C = {
    hdrTop:     [31, 41, 55]    as RGB,
    hdrBot:     [51, 65, 85]    as RGB,
    hdrAccent:  [100, 116, 139] as RGB,
    hdrAccent2: [148, 163, 184] as RGB,
    secPay:     [51, 65, 85]    as RGB,
    secPhy:     [51, 65, 85]    as RGB,
    secRec:     [51, 65, 85]    as RGB,
    secDetail:  [51, 65, 85]    as RGB,
    tblHeadPay: [51, 65, 85]    as RGB,
    tblHeadPhy: [51, 65, 85]    as RGB,
    tblHeadRec: [51, 65, 85]    as RGB,
    tblHeadSum: [51, 65, 85]    as RGB,
    tblAlt:     [250, 250, 251] as RGB,
    tblLine:    [229, 231, 235] as RGB,
    cardBg:     [248, 250, 252] as RGB,
    cardBdr:    [203, 213, 225] as RGB,
    text:       [15, 23, 42]    as RGB,
    muted:      [100, 116, 139] as RGB,
    white:      [255, 255, 255] as RGB,
    green:      [22, 163, 74]   as RGB,
    red:        [220, 38, 38]   as RGB,
    amber:      [202, 138, 4]   as RGB,
    blue:       [37, 99, 235]   as RGB,
    slate:      [71, 85, 105]   as RGB,
  };

  const studentName = safeText(payload.student.fullName || payload.student.email || 'Student', 'Student');

  const sectionLabels = {
    payments:         sinhalaLoaded ? 'Payments History / පන්ති ගාස්තු ගෙවීම්' : 'Payments History',
    physical:         sinhalaLoaded ? 'Physical Attendance / පන්ති පැමිණීම'      : 'Physical Attendance',
    recording:        sinhalaLoaded ? 'Recording Attendance / පටිගත නැරඹීම්'     : 'Recording Attendance',
    recordingDetails: sinhalaLoaded ? 'Recording Session Details / සැසි විස්තර'  : 'Recording Session Details',
  };

  const tableLabels = sinhalaLoaded ? SI : SI_EN;

  const preferredLetterheadUrl = payload.letterheadUrl || easyEnglishPdfHeader;
  const [avatarImage, letterheadImage] = await Promise.all([
    loadAvatarImage(payload.student.avatarUrl),
    loadAvatarImage(preferredLetterheadUrl),
  ]);

  const includedSections = [
    payload.options.includePayments            ? 'Payments'             : null,
    payload.options.includePhysicalAttendance  ? 'Physical Attendance'  : null,
    payload.options.includeRecordingAttendance ? 'Recording Attendance' : null,
  ].filter((v): v is string => Boolean(v));

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 1 HEADER
  // ─────────────────────────────────────────────────────────────────────────

  let y: number;

  /**
   * Builds the "Class · Subject" label, deduplicating when both values are
   * identical (case-insensitive). Used in both the letterhead strip and the
   * fallback banner.
   */
  const buildClassLabel = (): string => {
    const cn = safeText(payload.classInfo.name);
    const sj = safeText(payload.classInfo.subject);
    if (cn === '—' && sj === '—') return '';
    if (cn === '—') return sj;
    if (sj === '—' || sj.toLowerCase() === cn.toLowerCase()) return cn;
    return `${cn}  ·  ${sj}`;
  };

  if (letterheadImage) {
    // ── Letterhead image path ──────────────────────────────────────────────
    const MAX_LH_H = 45;
    const MIN_LH_H = 20;

    const naturalDims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = letterheadImage.dataUrl;
    });

    const aspectRatio = naturalDims.h / naturalDims.w;
    const rawH = PW * aspectRatio;
    const lhH  = Math.min(MAX_LH_H, Math.max(MIN_LH_H, rawH));

    doc.addImage(letterheadImage.dataUrl, letterheadImage.format, 0, 0, PW, lhH);

    // Divider lines below letterhead
    doc.setFillColor(...C.hdrAccent);
    doc.rect(0, lhH, PW, 1.0, 'F');
    doc.setFillColor(...C.hdrAccent2);
    doc.rect(0, lhH + 1.0, PW, 0.5, 'F');

    // ── Info strip ────────────────────────────────────────────────────────
    // Left:   student name  (bold, dark)
    // Center: class label   (deduplicated, muted)
    // Right:  generated ts  (muted)
    const stripY     = lhH + 2.0;
    const stripH     = 9;
    const stripTextY = stripY + 5.8;

    // Subtle strip background + top border
    doc.setFillColor(248, 250, 252);
    doc.rect(0, stripY, PW, stripH, 'F');
    doc.setFillColor(...C.cardBdr);
    doc.rect(0, stripY, PW, 0.3, 'F');

    // Left — student name
    doc.setTextColor(...C.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.text(studentName, 14, stripTextY);

    // Center — class · subject (only when not empty)
    const classLabel = buildClassLabel();
    if (classLabel) {
      doc.setTextColor(...C.muted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(classLabel, PW / 2, stripTextY, { align: 'center' });
    }

    // Right — generated timestamp
    doc.setTextColor(...C.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, PW - 14, stripTextY, { align: 'right' });

    y = lhH + stripH + 6;

  } else {
    // ── Fallback: modern gradient banner ─────────────────────────────────
    doc.setFillColor(...C.hdrTop);
    doc.rect(0, 0, PW, 48, 'F');
    doc.setFillColor(...C.hdrBot);
    doc.rect(0, 28, PW, 20, 'F');

    doc.setFillColor(...C.hdrAccent);
    doc.rect(0, 0, PW, 2.5, 'F');
    doc.setFillColor(...C.hdrAccent2);
    doc.rect(0, 2.5, PW, 1, 'F');
    doc.setFillColor(...C.hdrAccent);
    doc.rect(0, 47.5, PW, 0.8, 'F');
    doc.setFillColor(...C.hdrAccent2);
    doc.rect(0, 48.3, PW, 0.7, 'F');

    // Decorative circles
    doc.setFillColor(255, 255, 255);
    doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
    doc.circle(PW - 5, -10, 40, 'F');
    doc.circle(PW + 10, 25, 30, 'F');
    doc.circle(-5, 35, 28, 'F');
    doc.setGState(new (doc as any).GState({ opacity: 1.0 }));

    doc.setTextColor(...C.hdrAccent);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text('STUDENT REPORT', 16, 8.5);

    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18.5);
    doc.text(studentName, 16, 24);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.2);
    doc.setTextColor(186, 230, 253);
    doc.text(buildClassLabel() || 'No class info', 16, 31);

    doc.setTextColor(...C.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.text(`Generated ${fmtDateTime(new Date().toISOString())}`, PW - 16, 8.5, { align: 'right' });

    doc.setFontSize(8.5);
    doc.setTextColor(186, 230, 253);
    doc.setFont('helvetica', 'bold');
    doc.text(
      includedSections.length > 0 ? includedSections.join('  /  ') : 'No sections',
      PW - 16, 31, { align: 'right' },
    );

    y = 56;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STUDENT INFO CARD
  // ─────────────────────────────────────────────────────────────────────────

  const CARD_H = 42;

  // Card shadow
  doc.setFillColor(0, 0, 0);
  doc.setGState(new (doc as any).GState({ opacity: 0.04 }));
  doc.roundedRect(13.5, y + 0.8, PW - 27, CARD_H, 3, 3, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1.0 }));

  // Card background
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.hdrAccent2);
  doc.setLineWidth(0.6);
  doc.roundedRect(14, y, PW - 28, CARD_H, 3, 3, 'FD');

  // Left accent band
  doc.setFillColor(...C.hdrAccent2);
  doc.roundedRect(14, y, 4, CARD_H, 2.5, 0, 'F');
  doc.rect(18, y, 1, CARD_H, 'F');

  // Avatar
  const avX = 24, avY = y + 8, avSize = 26;
  if (avatarImage) {
    doc.addImage(avatarImage.dataUrl, avatarImage.format, avX, avY, avSize, avSize);
    doc.setDrawColor(...C.hdrAccent2);
    doc.setLineWidth(1.2);
    doc.circle(avX + avSize / 2, avY + avSize / 2, avSize / 2, 'S');
  } else {
    doc.setFillColor(...C.hdrAccent2);
    doc.circle(avX + avSize / 2, avY + avSize / 2, avSize / 2, 'F');
    doc.setDrawColor(...C.white);
    doc.setLineWidth(1.2);
    doc.circle(avX + avSize / 2, avY + avSize / 2, avSize / 2, 'S');
    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(initialsFromName(studentName), avX + avSize / 2, avY + avSize / 2 + 2, { align: 'center' });
  }

  // Student details — right of avatar
  const tx = avX + avSize + 8;

  doc.setTextColor(...C.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text(studentName, tx, y + 12);

  doc.setTextColor(...C.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`ID: ${payload.student.userId || '—'}`, tx, y + 18);

  doc.setFontSize(7.8);
  doc.text(`Email: ${payload.student.email || '—'}`, tx, y + 23);
  doc.text(`Phone: ${payload.student.phone || '—'}`, tx, y + 27);

  // Right column — payment info
  const rhs_x = PW - 48;
  doc.setTextColor(...C.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Payment Type:', rhs_x, y + 12);

  doc.setTextColor(...C.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(payload.student.paymentType || '—', rhs_x, y + 16.5);

  doc.setTextColor(...C.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Monthly Fee:', rhs_x, y + 22);

  const monthlyFee = payload.student.effectiveMonthlyFee || 0;
  doc.setTextColor(...C.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`Rs. ${monthlyFee.toLocaleString()}`, rhs_x, y + 26.5);

  y += CARD_H + 8;

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  const ensureSpace = (needed: number) => {
    if (y + needed <= PH - 18) return;
    doc.addPage();
    y = 18;
  };

  const drawSection = (title: string, subtitle: string | undefined, accentColor: RGB) => {
    ensureSpace(subtitle ? 14 : 11);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...C.cardBdr);
    doc.setLineWidth(0.25);
    doc.roundedRect(14, y, PW - 28, 9, 1.5, 1.5, 'FD');

    doc.setFillColor(...accentColor);
    doc.rect(14, y, 2.2, 9, 'F');

    doc.setTextColor(...accentColor);
    doc.setFont(headFont, 'bold');
    doc.setFontSize(9.6);
    doc.text(normalizeText(title), 19, y + 5.8);

    if (subtitle) {
      doc.setTextColor(...C.muted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.text(normalizeText(subtitle), PW - 16, y + 5.8, { align: 'right' });
    }

    doc.setTextColor(...C.text);
    y += subtitle ? 13 : 11;
  };

  const drawEmpty = (msg: string) => {
    ensureSpace(11);
    doc.setFillColor(250, 250, 252);
    doc.setDrawColor(...C.cardBdr);
    doc.setLineWidth(0.25);
    doc.roundedRect(14, y, PW - 28, 8, 1.5, 1.5, 'FD');
    doc.setTextColor(...C.muted);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.2);
    doc.text(msg, 20, y + 5.3);
    doc.setTextColor(...C.text);
    y += 12;
  };

  const drawStatCards = (items: Array<{ label: string; value: string; color: RGB }>) => {
    ensureSpace(18);
    const n = items.length;
    const cardW = (PW - 28 - (n - 1) * 3) / n;
    const cardH = 14;

    items.forEach((item, i) => {
      const cx = 14 + i * (cardW + 3);
      doc.setFillColor(...C.white);
      doc.setDrawColor(...C.cardBdr);
      doc.setLineWidth(0.25);
      doc.roundedRect(cx, y, cardW, cardH, 1.5, 1.5, 'FD');

      doc.setTextColor(...item.color);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(normalizeText(item.value), cx + cardW / 2, y + 6.8, { align: 'center' });

      doc.setTextColor(...C.muted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.text(normalizeText(item.label.toUpperCase()), cx + cardW / 2, y + 11.8, { align: 'center' });
    });

    y += 17;
  };

  const renderTable = (config: Record<string, any>, headColor: RGB, gap = 6) => {
    const startY = y;
    autoTable(doc, {
      ...config,
      startY: y,
      margin: { left: 16, right: 16 },
      theme: 'striped',
      styles: {
        fontSize: 8.2,
        cellPadding: { top: 2.4, bottom: 2.4, left: 3, right: 3 },
        textColor: [...C.text],
        lineColor: [...C.tblLine],
        lineWidth: 0,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [...headColor],
        textColor: [...C.white],
        fontStyle: 'normal',
        font: headFont,
        fontSize: 8.4,
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      },
      alternateRowStyles: { fillColor: [...C.tblAlt] },
      tableLineColor: [...C.cardBdr],
      tableLineWidth: 0.25,
    });
    y = ((doc as any).lastAutoTable?.finalY || startY) + gap;
  };

  const renderBadgeTable = (
    config: Record<string, any>,
    headColor: RGB,
    badgeColIndex: number,
    colorFn: (v: string) => { bg: RGB; text: RGB; label: string },
    gap = 6,
  ) => {
    const startY = y;
    autoTable(doc, {
      ...config,
      startY: y,
      margin: { left: 16, right: 16 },
      theme: 'striped',
      styles: {
        fontSize: 8.2,
        cellPadding: { top: 2.4, bottom: 2.4, left: 3, right: 3 },
        textColor: [...C.text],
        lineColor: [...C.tblLine],
        lineWidth: 0,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [...headColor],
        textColor: [...C.white],
        fontStyle: 'normal',
        font: headFont,
        fontSize: 8.4,
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      },
      alternateRowStyles: { fillColor: [...C.tblAlt] },
      tableLineColor: [...C.cardBdr],
      tableLineWidth: 0.25,
      didDrawCell: (data: any) => {
        if (data.section !== 'body' || data.column.index !== badgeColIndex) return;
        const raw = String(data.cell.raw || '');
        const colors = colorFn(raw);
        const { x, y: cy, width, height } = data.cell;
        const bW = Math.min(width - 4, 22);
        const bH = 4.8;
        const bX = x + (width - bW) / 2;
        const bY = cy + (height - bH) / 2;
        doc.setFillColor(...colors.bg);
        doc.roundedRect(bX, bY, bW, bH, 1.2, 1.2, 'F');
        doc.setTextColor(...colors.text);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.text(colors.label, bX + bW / 2, bY + bH / 2 + 1, { align: 'center' });
      },
    });
    y = ((doc as any).lastAutoTable?.finalY || startY) + gap;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PAYMENTS SECTION
  // ─────────────────────────────────────────────────────────────────────────

  if (payload.options.includePayments) {
    const rows = payload.payments?.rows || [];
    drawSection(sectionLabels.payments, `${rows.length} record(s)`, C.secPay);

    if (rows.length > 0) {
      drawStatCards([
        { label: 'Paid',    value: String(payload.payments?.paidCount    || 0), color: C.green },
        { label: 'Pending', value: String(payload.payments?.pendingCount || 0), color: C.amber },
        { label: 'Unpaid',  value: String(payload.payments?.unpaidCount  || 0), color: C.red   },
      ]);

      renderBadgeTable(
        {
          head: [[tableLabels.month, tableLabels.status, tableLabels.slips, tableLabels.latestSlip]],
          body: rows.map((r) => [
            safeText(r.label),
            safeText(r.status),
            String(r.slipCount || 0),
            // Resolve raw enum → friendly label for the Latest Slip column
            r.latestSlipStatus
              ? paymentStatusColors(r.latestSlipStatus).label
              : '—',
          ]),
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 34, halign: 'center' },
            2: { cellWidth: 18, halign: 'center' },
            3: { cellWidth: 34, halign: 'center' },
          },
        },
        C.tblHeadPay,
        1,
        paymentStatusColors,
        8,
      );
    } else {
      drawEmpty('No payment records found for this student.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHYSICAL ATTENDANCE SECTION
  // ─────────────────────────────────────────────────────────────────────────

  if (payload.options.includePhysicalAttendance) {
    const summary = payload.physicalAttendance?.summary;
    const pct     = summary?.percentage || 0;
    drawSection(sectionLabels.physical, `Attendance rate: ${pct}%`, C.secPhy);

    drawStatCards([
      { label: 'Total',   value: String(summary?.total   || 0), color: C.slate },
      { label: 'Present', value: String(summary?.present || 0), color: C.green },
      { label: 'Late',    value: String(summary?.late    || 0), color: C.amber },
      { label: 'Absent',  value: String(summary?.absent  || 0), color: C.red   },
      { label: 'Excused', value: String(summary?.excused || 0), color: C.blue  },
    ]);

    const physRows = payload.physicalAttendance?.rows || [];
    if (physRows.length > 0) {
      renderBadgeTable(
        {
          head: [[tableLabels.date, tableLabels.session, tableLabels.time, tableLabels.status]],
          body: physRows.map((r) => [
            // FIX: "YYYY-MM-DD" → "DD Mon YYYY" (avoids UTC shift)
            fmtAttendanceDate(r.date),
            // FIX: if the session field accidentally contains a raw date, format it;
            //      otherwise use the session name as-is
            /^\d{4}-\d{2}-\d{2}$/.test((r.session || '').trim())
              ? fmtAttendanceDate(r.session)
              : safeText(r.session),
            // FIX: suppress meaningless "00:00" placeholder times
            fmtSessionTime(r.sessionTime),
            safeText(r.status),
          ]),
          columnStyles: {
            0: { cellWidth: 34 },
            1: { cellWidth: 40 },
            2: { cellWidth: 30 },
            3: { cellWidth: 28, halign: 'center' },
          },
        },
        C.tblHeadPhy,
        3,
        attendanceStatusColors,
        8,
      );
    } else {
      drawEmpty('No physical attendance records found.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RECORDING ATTENDANCE SECTION
  // ─────────────────────────────────────────────────────────────────────────

  if (payload.options.includeRecordingAttendance) {
    const summaryRows = payload.recordingAttendance?.summaryRows || [];
    drawSection(sectionLabels.recording, `${summaryRows.length} recording(s) tracked`, C.secRec);

    if (summaryRows.length > 0) {
      renderTable(
        {
          head: [[
            tableLabels.recordingTitle,
            tableLabels.month,
            tableLabels.sessions,
            tableLabels.watchedTime,
            tableLabels.lastWatch,
          ]],
          body: summaryRows.map((r) => [
            safeText(r.title),
            safeText(r.month),
            String(r.sessions || 0),
            fmtDuration(r.watchedSec || 0),
            fmtDateTime(r.lastWatchedAt),
          ]),
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 22 },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 28, halign: 'right' },
            4: { cellWidth: 36 },
          },
        },
        C.tblHeadRec,
        8,
      );
    } else {
      drawEmpty('No recording activity found for this student.');
    }

    if (payload.options.recordingMode === 'FULL') {
      const sessionRows = payload.recordingAttendance?.sessionRows || [];
      drawSection(sectionLabels.recordingDetails, `${sessionRows.length} session(s)`, C.secDetail);

      if (sessionRows.length > 0) {
        renderBadgeTable(
          {
            head: [[
              tableLabels.recordingTitle,
              tableLabels.started,
              tableLabels.ended,
              tableLabels.watched,
              tableLabels.status,
            ]],
            body: sessionRows.map((r) => [
              safeText(r.title),
              fmtDateTime(r.startedAt),
              fmtDateTime(r.endedAt),
              fmtDuration(r.watchedSec || 0),
              safeText(r.status),
            ]),
            columnStyles: {
              0: { cellWidth: 40 },
              1: { cellWidth: 34 },
              2: { cellWidth: 34 },
              3: { cellWidth: 24, halign: 'right' },
              4: { cellWidth: 26, halign: 'center' },
            },
          },
          C.tblHeadRec,
          4,
          recordingStatusColors,
          8,
        );
      } else {
        drawEmpty('No recording session details found.');
      }
    }
  }

  // Nothing selected
  if (
    !payload.options.includePayments &&
    !payload.options.includePhysicalAttendance &&
    !payload.options.includeRecordingAttendance
  ) {
    drawSection('No Sections Selected', undefined, C.slate);
    drawEmpty('Select at least one section (Payments, Physical Attendance, or Recording Attendance) before exporting.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER — every page
  // ─────────────────────────────────────────────────────────────────────────

  const pageCount    = doc.getNumberOfPages();
  const footerLeft   = payload.footer?.left   ?? `Class: ${payload.classInfo.name || '—'}`;
  const footerCenter = payload.footer?.center ?? studentName;

  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);

    doc.setFillColor(...C.hdrAccent2);
    doc.rect(0, PH - 10, PW, 0.8, 'F');

    doc.setFillColor(250, 250, 252);
    doc.rect(0, PH - 9.2, PW, 9.2, 'F');

    doc.setTextColor(...C.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(footerLeft,                 14,      PH - 3.8);
    doc.text(footerCenter,               PW / 2,  PH - 3.8, { align: 'center' });
    doc.text(`Page ${p} / ${pageCount}`, PW - 14, PH - 3.8, { align: 'right' });
  }

  return doc.output('blob');
}

// ─── Utility exports ────────────────────────────────────────────────────────

export function normalizeDateLabel(year: number, month: number, name?: string): string {
  if (name && name.trim()) return name.trim();
  const d = new Date(year, month - 1, 1);
  if (Number.isNaN(d.getTime())) return `${year}-${String(month).padStart(2, '0')}`;
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function normalizePhysicalDate(dateText: string): string {
  if (!dateText) return '—';
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  return fmtDate(date.toISOString());
}