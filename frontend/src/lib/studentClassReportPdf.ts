import api from './api';
import easyEnglishPdfHeader from '../assets/easy-english-pdf-header.png';
import notoSansSinhalaUrl from '../assets/fonts/NotoSansSinhala.ttf?url';

// ─── Section Banner Imports ───────────────────────────────────────────────────
import paymentBannerUrl from '../assets/banners/paymentbanner.png';
import physicalAttendanceBannerUrl from '../assets/banners/pycycleattendancebanner.png';
import recordingHistoryBannerUrl from '../assets/banners/recordinghistorybanner.png';

export type RecordingReportMode = 'SUMMARY' | 'FULL';

export interface StudentClassReportPayload {
  letterheadUrl?: string | null;
  classInfo: { id?: string; name?: string; subject?: string | null };
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
  footer?: { left?: string | null; center?: string | null } | null;
  options: {
    includePayments: boolean;
    includePhysicalAttendance: boolean;
    includeRecordingAttendance: boolean;
    recordingMode: RecordingReportMode;
  };
  payments?: {
    rows: Array<{ label: string; status: string; slipCount: number; latestSlipStatus?: string | null }>;
    paidCount: number;
    pendingCount: number;
    unpaidCount: number;
  };
  physicalAttendance?: {
    summary: { total: number; present: number; late: number; absent: number; excused: number; percentage: number };
    rows: Array<{ date: string; session: string; sessionTime: string; status: string; weekName?: string | null }>;
    weekGroupOrder?: string[];
  };
  recordingAttendance?: {
    summaryRows: Array<{ title: string; month: string; sessions: number; watchedSec: number; lastWatchedAt?: string | null }>;
    sessionRows: Array<{ title: string; startedAt?: string; endedAt?: string | null; watchedSec: number; status: string }>;
  };
}

// ─── Banner dimensions (mm) ───────────────────────────────────────────────────
const BANNER_W = 210; // full A4 width
const BANNER_H = 15;  // as specified

// ─── Sinhala Font (Noto Sans Sinhala — bundled TTF) ──────────────────────────
const SINHALA_FONT_NAME = 'NotoSansSinhala';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary);
}

async function registerSinhalaFont(doc: any): Promise<boolean> {
  try {
    const fileName = `${SINHALA_FONT_NAME}.ttf`;
    let alreadyRegistered = false;
    try {
      alreadyRegistered = Boolean((doc as any).getFileFromVFS?.(fileName));
    } catch {
      alreadyRegistered = false;
    }
    if (!alreadyRegistered) {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 12_000);
      const response = await fetch(notoSansSinhalaUrl, { signal: controller.signal });
      clearTimeout(tid);
      if (!response.ok) return false;
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const isTTF =
        (bytes[0] === 0x00 && bytes[1] === 0x01) ||
        (bytes[0] === 0x74 && bytes[1] === 0x72);
      if (!isTTF) return false;
      const base64Font = arrayBufferToBase64(buffer);
      doc.addFileToVFS(fileName, base64Font);
      doc.addFont(fileName, SINHALA_FONT_NAME, 'normal');
      doc.addFont(fileName, SINHALA_FONT_NAME, 'bold');
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Table Column Labels ──────────────────────────────────────────────────────
const TABLE_LABELS = {
  month: 'Month', status: 'Status', slips: 'Slips', latestSlip: 'Latest Slip',
  date: 'Date', session: 'Session', time: 'Time', total: 'Total', present: 'Present',
  late: 'Late', absent: 'Absent', excused: 'Excused', attendancePct: 'Attendance %',
  recordingTitle: 'Recording', sessions: 'Sessions', watchedTime: 'Watched',
  lastWatch: 'Last Watched', started: 'Started', startedAt: 'Started', ended: 'Ended', watched: 'Watched',
} as const;

// ─── Formatters ───────────────────────────────────────────────────────────────
type RGB = [number, number, number];

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    '  ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtAttendanceDate(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '' || raw === '—') return '—';
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? s
      : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return fmtDate(s);
  return s;
}

function fmtSessionTime(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '' || raw === '—') return '—';
  const s = raw.trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(':');
    const display = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    return display === '00:00' ? '—' : display;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return safeText(s);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return time === '00:00' ? '—' : time;
}

function cleanSessionLabel(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '') return '—';
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return fmtAttendanceDate(s.slice(0, 10));
  const upper = s.toUpperCase();
  if (upper === 'AUTO_CLOSE' || upper === 'AUTO_CLOSED') return 'Auto Closed';
  if (upper === 'AUTO_OPEN'  || upper === 'AUTO_OPENED') return 'Auto Opened';
  if (upper === 'MANUAL')   return 'Manual';
  if (upper === 'LIVE')     return 'Live Session';
  if (upper === 'RECORDED') return 'Recorded';
  if (upper === 'ONLINE')   return 'Online';
  if (upper === 'PHYSICAL') return 'Physical';
  return s;
}

function normalizeText(value?: string | null): string {
  return String(value || '')
    .replace(/â€"|â€"/g, '-')
    .replace(/â€œ|â€/g, '"')
    .replace(/â€˜|â€™/g, "'")
    .replace(/Â/g, '');
}

function safeText(value: string | null | undefined, fallback = '—'): string {
  return normalizeText(value).trim() || fallback;
}

function cleanFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
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
  const apiBase =
    typeof api.defaults.baseURL === 'string' ? api.defaults.baseURL : '';
  let origin = window.location.origin;
  if (/^https?:\/\//i.test(apiBase)) {
    try { origin = new URL(apiBase).origin; } catch { /**/ }
  }
  if (value.startsWith('/')) return `${origin}${value}`;
  return `${origin}/${value.replace(/^\/+/, '')}`;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed'));
    };
    reader.onerror = () => reject(new Error('Failed'));
    reader.readAsDataURL(blob);
  });
}

// FIXED: Removed the local-origin check so external avatars can load successfully.
async function loadImage(
  rawUrl?: string | null,
): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  const resolved = resolveAssetUrl(rawUrl || '');
  if (!resolved) return null;
  try {
    if (/^data:image\//i.test(resolved)) {
      return {
        dataUrl: resolved,
        format: resolved.toLowerCase().startsWith('data:image/png') ? 'PNG' : 'JPEG',
      };
    }

    const targetUrl = new URL(resolved, window.location.origin);
    const isCrossOrigin = targetUrl.origin !== window.location.origin;

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);

    const fetchOpts: RequestInit = {
      signal: controller.signal,
      headers: { Accept: 'image/*' },
    };

    // Prevent CORS errors by omitting credentials for external images (like S3/Google)
    if (!isCrossOrigin) {
      fetchOpts.credentials = 'include';
    }

    const response = await fetch(targetUrl.toString(), fetchOpts);
    clearTimeout(tid);
    
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;

    return {
      dataUrl: await blobToDataUrl(blob),
      format: blob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG',
    };
  } catch {
    return null;
  }
}

async function loadBundledImage(
  importedUrl: string,
): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(importedUrl, { signal: controller.signal });
    clearTimeout(tid);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return {
      dataUrl: await blobToDataUrl(blob),
      format: blob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG',
    };
  } catch {
    return null;
  }
}

// ─── Status Badge Colors ──────────────────────────────────────────────────────
function paymentStatusColors(raw: string | null | undefined): {
  bg: RGB; text: RGB; label: string;
} {
  const v = (raw || '').trim().toUpperCase();
  if (v === 'PAID' || v === 'VERIFIED')
    return { bg: [220, 252, 231], text: [22, 101, 52], label: 'Paid' };
  if (v === 'PENDING')
    return { bg: [254, 249, 195], text: [133, 77, 14], label: 'Pending' };
  if (v === 'LATE')
    return { bg: [255, 237, 213], text: [154, 52, 18], label: 'Late' };
  if (v === 'UNPAID' || v === 'REJECTED')
    return { bg: [254, 226, 226], text: [153, 27, 27], label: 'Unpaid' };
  return { bg: [241, 245, 249], text: [71, 85, 105], label: v || '—' };
}

function attendanceStatusColors(raw: string | null | undefined): {
  bg: RGB; text: RGB; label: string;
} {
  const v = (raw || '').trim().toUpperCase();
  if (v === 'PRESENT')
    return { bg: [220, 252, 231], text: [22, 101, 52], label: 'Present' };
  if (v === 'LATE')
    return { bg: [255, 237, 213], text: [154, 52, 18], label: 'Late' };
  if (v === 'ABSENT')
    return { bg: [254, 226, 226], text: [153, 27, 27], label: 'Absent' };
  if (v === 'EXCUSED')
    return { bg: [224, 242, 254], text: [14, 116, 163], label: 'Excused' };
  return { bg: [241, 245, 249], text: [71, 85, 105], label: v || '—' };
}

function recordingStatusColors(raw: string | null | undefined): {
  bg: RGB; text: RGB; label: string;
} {
  const v = (raw || '').trim().toUpperCase();
  if (v === 'WATCHED' || v === 'COMPLETED')
    return { bg: [220, 252, 231], text: [22, 101, 52], label: 'Watched' };
  if (v === 'PARTIAL')
    return { bg: [255, 237, 213], text: [154, 52, 18], label: 'Partial' };
  if (v === 'NOT_WATCHED' || v === 'UNWATCHED')
    return { bg: [254, 226, 226], text: [153, 27, 27], label: 'Unwatched' };
  return { bg: [241, 245, 249], text: [71, 85, 105], label: v || '—' };
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function createStudentClassReportFileName(
  studentName: string,
  instituteId?: string | null,
): string {
  const suffix = instituteId ? `${studentName}-${instituteId}` : studentName;
  return cleanFileName(`Student-Report-${suffix}.pdf`);
}

export async function buildStudentClassReportPdf(
  payload: StudentClassReportPayload,
): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();

  const sinhalaLoaded = await registerSinhalaFont(doc);
  const SF = sinhalaLoaded ? SINHALA_FONT_NAME : 'helvetica';

  // ── Color Palette ──────────────────────────────────────────────────────────
  const C = {
    pageBg:    [238, 242, 250] as RGB,
    white:     [255, 255, 255] as RGB,
    cardBdr:   [208, 220, 238] as RGB,
    rowAlt:    [246, 249, 253] as RGB,
    hdrBg:     [11, 15, 42]   as RGB,
    hdrBlue:   [79, 70, 229]  as RGB,
    hdrAccent: [165, 180, 252] as RGB,
    hdrMuted:  [100, 116, 145] as RGB,
    secPay:    [79, 70, 229]  as RGB,
    secPhy:    [5, 150, 105]  as RGB,
    secRec:    [217, 119, 6]  as RGB,
    secDet:    [124, 58, 237] as RGB,
    tblPay:    [67, 56, 202]  as RGB,
    tblPhy:    [4, 120, 87]   as RGB,
    tblRec:    [180, 95, 6]   as RGB,
    tblDet:    [109, 40, 217] as RGB,
    textDark:  [12, 18, 50]   as RGB,
    textMuted: [90, 108, 138] as RGB,
    textLight: [148, 163, 192] as RGB,
    green:     [5, 150, 105]  as RGB,
    red:       [220, 38, 38]  as RGB,
    amber:     [202, 138, 4]  as RGB,
    blue:      [37, 99, 235]  as RGB,
    slate:     [71, 85, 105]  as RGB,
  };

  const studentName = safeText(
    payload.student.fullName || payload.student.email || 'Student',
    'Student',
  );

  const sectionLabels = {
    payments:  sinhalaLoaded ? 'ගෙවීම් ඉතිහාසය  /  Payments History'      : 'Payments History',
    physical:  sinhalaLoaded ? 'භෞතික පැමිණීම  /  Physical Attendance'     : 'Physical Attendance',
    recording: sinhalaLoaded ? 'පටිගත නැරඹීම  /  Recording Attendance'     : 'Recording Attendance',
    recDetail: sinhalaLoaded ? 'සැසි විස්තර  /  Recording Session Details' : 'Recording Session Details',
  };

  const preferredLetterheadUrl = payload.letterheadUrl || easyEnglishPdfHeader;

  // ── Load all images concurrently (letterhead + avatar + 3 banners) ──────────
  const [
    avatarImage,
    letterheadImage,
    paymentBannerImage,
    physicalBannerImage,
    recordingBannerImage,
  ] = await Promise.all([
    loadImage(payload.student.avatarUrl),
    loadImage(preferredLetterheadUrl),
    loadBundledImage(paymentBannerUrl),
    loadBundledImage(physicalAttendanceBannerUrl),
    loadBundledImage(recordingHistoryBannerUrl),
  ]);

  let letterheadH = 0;
  if (letterheadImage) {
    const naturalDims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload  = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = letterheadImage.dataUrl;
    });
    letterheadH = Math.min(45, Math.max(18, PW * (naturalDims.h / naturalDims.w)));
  }

  const includedSections = [
    payload.options.includePayments            ? 'Payments'             : null,
    payload.options.includePhysicalAttendance  ? 'Physical Attendance'  : null,
    payload.options.includeRecordingAttendance ? 'Recording Attendance' : null,
  ].filter((v): v is string => Boolean(v));

  let y = 0;

  const buildClassLabel = (): string => {
    const cn = safeText(payload.classInfo.name);
    const sj = safeText(payload.classInfo.subject);
    if (cn === '—' && sj === '—') return '';
    if (cn === '—') return sj;
    if (sj === '—' || sj.toLowerCase() === cn.toLowerCase()) return cn;
    return `${cn}  ·  ${sj}`;
  };

  // ── Page background + ONLY FIRST PAGE HEADER ──────────────────────────────
  const paintPage = (pageNum: number) => {
    doc.setFillColor(...C.pageBg);
    doc.rect(0, 0, PW, PH, 'F');

    // ONLY DRAW HEADER ON PAGE 1
    if (pageNum === 1) {
      if (letterheadImage) {
        // ── Page 1: full letterhead + sub-strip with generated date ─────
        doc.addImage(letterheadImage.dataUrl, letterheadImage.format, 0, 0, PW, letterheadH);
        doc.setFillColor(...C.hdrBlue);
        doc.rect(0, letterheadH, PW, 1.5, 'F');
        const sY = letterheadH + 1.5, sH = 11, sTextY = sY + 7.2;
        doc.setFillColor(244, 246, 251);
        doc.rect(0, sY, PW, sH, 'F');
        doc.setFillColor(...C.hdrBlue);
        doc.rect(0, sY, 3.5, sH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...C.textDark);
        doc.text(studentName, 10, sTextY);
        const cl = buildClassLabel();
        if (cl) {
          doc.setFont(SF, 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...C.textMuted);
          doc.text(normalizeText(cl), PW / 2, sTextY, { align: 'center' });
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.textMuted);
        doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, PW - 12, sTextY, { align: 'right' });
        doc.setFillColor(...C.cardBdr);
        doc.rect(0, sY + sH, PW, 0.4, 'F');

      } else {
        // ── No letterhead, page 1: full hero dark header ─────────────────
        doc.setFillColor(...C.hdrBg);
        doc.rect(0, 0, PW, 58, 'F');
        doc.setFillColor(...C.hdrBlue);
        doc.rect(0, 0, PW, 4, 'F');
        doc.setFillColor(255, 255, 255);
        doc.setGState(new (doc as any).GState({ opacity: 0.04 }));
        doc.circle(PW + 10, -8, 65, 'F');
        doc.circle(-10, 64, 38, 'F');
        doc.circle(PW - 25, 58, 28, 'F');
        doc.setGState(new (doc as any).GState({ opacity: 1 }));
        doc.setFillColor(79, 70, 229);
        doc.setGState(new (doc as any).GState({ opacity: 0.25 }));
        doc.roundedRect(14, 10, 58, 6, 1.5, 1.5, 'F');
        doc.setGState(new (doc as any).GState({ opacity: 1 }));
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...C.hdrAccent);
        doc.text('STUDENT PROGRESS REPORT', 16.5, 14.2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.hdrMuted);
        doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, PW - 14, 14.2, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text(studentName, 14, 32);
        const cl = buildClassLabel();
        doc.setFont(SF, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...C.hdrAccent);
        doc.text(normalizeText(cl || 'Student Progress Report'), 14, 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.hdrMuted);
        doc.text(
          includedSections.length > 0 ? includedSections.join('  ·  ') : 'No sections selected',
          PW - 14, 42, { align: 'right' },
        );
        doc.setFillColor(...C.hdrBlue);
        doc.rect(0, 54, PW, 4, 'F');
      }
    }
  };

  paintPage(1);

  // ── New page helper ────────────────────────────────────────────────────────
  const newPage = () => {
    doc.addPage();
    const pn = doc.getNumberOfPages();
    paintPage(pn);
    y = 20; // Only margin space needed since header is omitted on page 2+
  };

  const ensureSpace = (n: number) => {
    if (y + n > PH - 16) newPage();
  };

  y = letterheadImage ? letterheadH + 1.5 + 11 + 10 : 68;

  // ── Section banner renderer ────────────────────────────────────────────────
  const drawSectionBanner = (
    bannerImg: { dataUrl: string; format: 'PNG' | 'JPEG' } | null,
    fallbackTitle: string,
    fallbackSubtitle: string | undefined,
    fallbackColour: RGB,
    recordCount?: number,
  ) => {
    if (bannerImg) {
      ensureSpace(BANNER_H + 10);
      doc.setFillColor(0, 0, 0);
      doc.setGState(new (doc as any).GState({ opacity: 0.07 }));
      doc.rect(0, y - 0.5, PW, 1, 'F');
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
      doc.addImage(bannerImg.dataUrl, bannerImg.format, 0, y, BANNER_W, BANNER_H);
      doc.setFillColor(0, 0, 0);
      doc.setGState(new (doc as any).GState({ opacity: 0.10 }));
      doc.rect(0, y + BANNER_H - 0.5, PW, 1, 'F');
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
      if (recordCount !== undefined) {
        const badgeW = 38, badgeH = 7, badgeX = PW - badgeW - 6, badgeY = y + (BANNER_H - badgeH) / 2;
        doc.setFillColor(0, 0, 0);
        doc.setGState(new (doc as any).GState({ opacity: 0.42 }));
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3.5, 3.5, 'F');
        doc.setGState(new (doc as any).GState({ opacity: 1 }));
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text(`${recordCount} record(s)`, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1.3, { align: 'center' });
      }
      y += BANNER_H + 7;
    } else {
      drawSection(fallbackTitle, fallbackSubtitle, fallbackColour);
    }
  };

  // ── Original section header ────────────────────────────────────────────────
  const drawSection = (title: string, subtitle: string | undefined, colour: RGB) => {
    const sepIdx = title.indexOf('  /  ');
    const hasBilingual = sepIdx !== -1;
    const sinhalaTitle = hasBilingual ? title.slice(0, sepIdx).trim() : null;
    const englishTitle = hasBilingual ? title.slice(sepIdx + 5).trim() : title;
    const H = hasBilingual ? 16 : 13;
    ensureSpace(H + 8);

    doc.setFillColor(0, 0, 0);
    doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
    doc.roundedRect(14.5, y + 0.5, PW - 28, H, 2.5, 2.5, 'F');
    doc.setGState(new (doc as any).GState({ opacity: 1 }));

    doc.setFillColor(...C.white);
    doc.setDrawColor(...colour);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, y, PW - 28, H, 2.5, 2.5, 'FD');
    doc.setFillColor(...colour);
    doc.roundedRect(14, y, 6, H, 2.5, 0, 'F');
    doc.rect(18.5, y, 1.5, H, 'F');

    if (hasBilingual && sinhalaTitle) {
      doc.setFont(SF, 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(...colour);
      doc.text(sinhalaTitle, 27, y + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.textMuted);
      doc.text(englishTitle, 27, y + 13);
      if (subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...C.textMuted);
        doc.text(subtitle, PW - 16, y + 9.5, { align: 'right' });
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...colour);
      doc.text(englishTitle, 27, y + 8.8);
      if (subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.textMuted);
        doc.text(subtitle, PW - 16, y + 8.8, { align: 'right' });
      }
    }

    doc.setTextColor(...C.textDark);
    y += H + 7;
  };

  const drawEmptyState = (msg: string) => {
    ensureSpace(14);
    doc.setFillColor(250, 251, 253);
    doc.setDrawColor(...C.cardBdr);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, y, PW - 28, 10, 2.5, 2.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.textMuted);
    doc.text(normalizeText(msg), PW / 2, y + 6.8, { align: 'center' });
    y += 16;
  };

  // ── KPI stat cards ─────────────────────────────────────────────────────────
  const drawStatRow = (items: Array<{ label: string; value: string; color: RGB }>) => {
    ensureSpace(30);
    const n = items.length;
    const gap = 3.5;
    const cardW = (PW - 28 - gap * (n - 1)) / n;
    const cardH = 22;

    items.forEach((item, i) => {
      const cx = 14 + i * (cardW + gap);
      doc.setFillColor(0, 0, 0);
      doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
      doc.roundedRect(cx + 0.6, y + 0.6, cardW, cardH, 3, 3, 'F');
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
      doc.setFillColor(...C.white);
      doc.setDrawColor(...C.cardBdr);
      doc.setLineWidth(0.3);
      doc.roundedRect(cx, y, cardW, cardH, 3, 3, 'FD');
      doc.setFillColor(...item.color);
      doc.roundedRect(cx, y, cardW, 4, 3, 0, 'F');
      doc.rect(cx, y + 2, cardW, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...item.color);
      doc.text(item.value, cx + cardW / 2, y + 14.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.textMuted);
      doc.text(item.label.toUpperCase(), cx + cardW / 2, y + 19.5, { align: 'center' });
    });
    y += cardH + 7;
  };

  // ── Table helpers ──────────────────────────────────────────────────────────
  const sharedTableStyles = (hdrColor: RGB) => ({
    margin: { left: 14, right: 14 },
    theme: 'striped' as const,
    styles: {
      fontSize: 8.5, cellPadding: 3.5, textColor: [...C.textDark] as number[],
      overflow: 'linebreak' as const, lineWidth: 0, font: 'helvetica',
    },
    headStyles: {
      fillColor: [...hdrColor] as number[], textColor: [255, 255, 255] as number[],
      fontStyle: 'bold' as const, font: 'helvetica', fontSize: 8.5, cellPadding: 4,
    },
    alternateRowStyles: { fillColor: [...C.rowAlt] as number[] },
    tableLineColor: [...C.cardBdr] as number[],
    tableLineWidth: 0.3,
  });

  const renderTable = (config: Record<string, any>, hdrColor: RGB, gap = 7) => {
    const sy = y;
    autoTable(doc, { ...config, startY: y, ...sharedTableStyles(hdrColor) });
    y = ((doc as any).lastAutoTable?.finalY ?? sy) + gap;
  };

  const renderBadgeTable = (
    config: Record<string, any>,
    hdrColor: RGB,
    badgeCol: number,
    colorFn: (v: string) => { bg: RGB; text: RGB; label: string },
    gap = 7,
  ) => {
    const sy = y;
    autoTable(doc, {
      ...config,
      startY: y,
      ...sharedTableStyles(hdrColor),
      didDrawCell: (data: any) => {
        if (data.section !== 'body' || data.column.index !== badgeCol) return;
        const col = colorFn(String(data.cell.raw || ''));
        const { x, y: cy, width, height } = data.cell;
        const bW = Math.min(width - 6, 28), bH = 6;
        const bX = x + (width - bW) / 2, bY = cy + (height - bH) / 2;
        doc.setFillColor(...col.bg);
        doc.roundedRect(bX, bY, bW, bH, 1.8, 1.8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...col.text);
        doc.text(col.label, bX + bW / 2, bY + bH / 2 + 1.2, { align: 'center' });
      },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? sy) + gap;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // COMPACT STUDENT INFO CARD (Page 1 only)
  // ─────────────────────────────────────────────────────────────────────────

  const CARD_H = 26;
  const CARD_X = 14;
  const CARD_W = PW - 28;

  // Drop-shadow
  doc.setFillColor(0, 0, 0);
  doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
  doc.roundedRect(CARD_X + 0.8, y + 0.8, CARD_W, CARD_H, 3, 3, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // Card background
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.cardBdr);
  doc.setLineWidth(0.3);
  doc.roundedRect(CARD_X, y, CARD_W, CARD_H, 3, 3, 'FD');

  // Left accent strip
  doc.setFillColor(...C.hdrBlue);
  doc.roundedRect(CARD_X, y, 4, CARD_H, 3, 0, 'F');
  doc.rect(CARD_X + 2, y, 2, CARD_H, 'F'); // flush to make the left side square inside

  // Avatar
  const avR = 8;
  const avCx = CARD_X + 16;
  const avCy = y + CARD_H / 2;

  if (avatarImage) {
    doc.setFillColor(...C.white);
    doc.circle(avCx, avCy, avR + 0.5, 'F');
    doc.addImage(avatarImage.dataUrl, avatarImage.format, avCx - avR, avCy - avR, avR * 2, avR * 2);
    
    // Slight masking border
    doc.setDrawColor(...C.white);
    doc.setLineWidth(1.5);
    doc.circle(avCx, avCy, avR + 0.8, 'S');

    // Colored outer ring
    doc.setDrawColor(...C.hdrBlue);
    doc.setLineWidth(0.6);
    doc.circle(avCx, avCy, avR, 'S');
  } else {
    doc.setFillColor(...C.hdrAccent);
    doc.circle(avCx, avCy, avR, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(initialsFromName(studentName), avCx, avCy + 2.5, { align: 'center' });
  }

  // Name & Institute ID
  const nameX = avCx + avR + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.textDark);
  doc.text(studentName, nameX, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  const instId = safeText(payload.student.instituteId, '—');
  doc.text(`ID: ${instId}`, nameX, y + 17);

  // Phone
  const phoneX = CARD_X + CARD_W - 12;
  const phoneStr = safeText(payload.student.phone, '—');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...C.textDark);
  doc.text(phoneStr, phoneX, y + 11, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.textLight);
  doc.text('PHONE', phoneX, y + 17, { align: 'right' });

  y += CARD_H + 10;

  // ─────────────────────────────────────────────────────────────────────────
  // PAYMENTS — with banner
  // ─────────────────────────────────────────────────────────────────────────

  if (payload.options.includePayments) {
    const rows = payload.payments?.rows ?? [];
    drawSectionBanner(
      paymentBannerImage,
      sectionLabels.payments,
      `${rows.length} record(s)`,
      C.secPay,
      rows.length,
    );

    if (rows.length > 0) {
      drawStatRow([
        { label: 'Paid',    value: String(payload.payments?.paidCount    ?? 0), color: C.green },
        { label: 'Pending', value: String(payload.payments?.pendingCount ?? 0), color: C.amber },
        { label: 'Unpaid',  value: String(payload.payments?.unpaidCount  ?? 0), color: C.red   },
      ]);
      renderBadgeTable(
        {
          head: [[TABLE_LABELS.month, TABLE_LABELS.status, TABLE_LABELS.slips, TABLE_LABELS.latestSlip]],
          body: rows.map((r) => [
            safeText(r.label),
            safeText(r.status),
            String(r.slipCount || 0),
            r.latestSlipStatus ? paymentStatusColors(r.latestSlipStatus).label : '—',
          ]),
          columnStyles: {
            0: { cellWidth: 57 },
            1: { cellWidth: 44, halign: 'center' },
            2: { cellWidth: 28, halign: 'center' },
            3: { cellWidth: 53, halign: 'center' },
          },
        },
        C.tblPay, 1, paymentStatusColors, 11,
      );
    } else {
      drawEmptyState('No payment records found for this student.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHYSICAL ATTENDANCE — with banner
  // ─────────────────────────────────────────────────────────────────────────

  if (payload.options.includePhysicalAttendance) {
    const summary = payload.physicalAttendance?.summary;
    const pct = summary?.percentage ?? 0;
    const rows = payload.physicalAttendance?.rows ?? [];

    drawSectionBanner(
      physicalBannerImage,
      sectionLabels.physical,
      `Attendance rate: ${pct}%`,
      C.secPhy,
      rows.length,
    );

    drawStatRow([
      { label: 'Total',   value: String(summary?.total   ?? 0), color: C.slate },
      { label: 'Present', value: String(summary?.present ?? 0), color: C.green },
      { label: 'Late',    value: String(summary?.late    ?? 0), color: C.amber },
      { label: 'Absent',  value: String(summary?.absent  ?? 0), color: C.red   },
      { label: 'Excused', value: String(summary?.excused ?? 0), color: C.blue  },
    ]);

    const weekGroupOrder = payload.physicalAttendance?.weekGroupOrder ?? [];

    const attendanceTableConfig = (bodyRows: typeof rows) => ({
      head: [[TABLE_LABELS.date, TABLE_LABELS.session, TABLE_LABELS.time, TABLE_LABELS.status]],
      body: bodyRows.map((r) => [
        fmtAttendanceDate(r.date),
        cleanSessionLabel(r.session),
        fmtSessionTime(r.sessionTime),
        safeText(r.status),
      ]),
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 88 },
        2: { cellWidth: 28, halign: 'center' },
        3: { cellWidth: 26, halign: 'center' },
      },
    });

    if (rows.length > 0) {
      renderBadgeTable(attendanceTableConfig(rows), C.tblPhy, 3, attendanceStatusColors, 11);
    } else {
      drawEmptyState('No physical attendance records found.');
    }

    if (weekGroupOrder.length > 0) {
      const weekLabel = sinhalaLoaded
        ? 'සතිය අනුව ඉදිරිපත් කිරීම  /  Week-by-Week Breakdown'
        : 'Week-by-Week Breakdown';
      drawSection(weekLabel, `${weekGroupOrder.length} group(s)`, C.secPhy);

      for (const weekName of weekGroupOrder) {
        const weekRows = rows.filter((r) => r.weekName === weekName);
        if (weekRows.length === 0) continue;

        const present = weekRows.filter((r) => r.status?.toUpperCase() === 'PRESENT').length;
        const late    = weekRows.filter((r) => r.status?.toUpperCase() === 'LATE').length;
        const absent  = weekRows.filter((r) => r.status?.toUpperCase() === 'ABSENT').length;
        const excused = weekRows.filter((r) => r.status?.toUpperCase() === 'EXCUSED').length;
        const weekPct = weekRows.length > 0
          ? Math.round(((present + late) / weekRows.length) * 100) : 0;

        ensureSpace(14);

        doc.setFillColor(...C.secPhy);
        doc.setGState(new (doc as any).GState({ opacity: 0.10 }));
        doc.roundedRect(14, y, PW - 28, 10, 2, 2, 'F');
        doc.setGState(new (doc as any).GState({ opacity: 1 }));
        doc.setFillColor(...C.secPhy);
        doc.roundedRect(14, y, 4, 10, 2, 0, 'F');
        doc.rect(16.5, y, 1.5, 10, 'F');
        doc.setFont(SF, 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...C.secPhy);
        doc.text(normalizeText(weekName), 22, y + 6.8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.textMuted);
        doc.text(
          `${weekPct}% attended  ·  ${present} present  ·  ${late} late  ·  ${absent} absent${excused ? `  ·  ${excused} excused` : ''}`,
          PW - 16, y + 6.8, { align: 'right' },
        );

        y += 13;
        renderBadgeTable(attendanceTableConfig(weekRows), C.tblPhy, 3, attendanceStatusColors, 9);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RECORDING ATTENDANCE — with banner
  // ─────────────────────────────────────────────────────────────────────────

  if (payload.options.includeRecordingAttendance) {
    const summaryRows = payload.recordingAttendance?.summaryRows ?? [];

    drawSectionBanner(
      recordingBannerImage,
      sectionLabels.recording,
      `${summaryRows.length} recording(s) tracked`,
      C.secRec,
      summaryRows.length,
    );

    if (summaryRows.length > 0) {
      renderTable(
        {
          head: [[TABLE_LABELS.recordingTitle, TABLE_LABELS.month, TABLE_LABELS.sessions, TABLE_LABELS.watchedTime, TABLE_LABELS.lastWatch]],
          body: summaryRows.map((r) => [
            safeText(r.title),
            safeText(r.month),
            String(r.sessions || 0),
            fmtDuration(r.watchedSec || 0),
            fmtDateTime(r.lastWatchedAt),
          ]),
          columnStyles: {
            0: { cellWidth: 68 },
            1: { cellWidth: 28 },
            2: { cellWidth: 22, halign: 'center' },
            3: { cellWidth: 26, halign: 'center' },
            4: { cellWidth: 38 },
          },
        },
        C.tblRec, 9,
      );
    } else {
      drawEmptyState('No recording activity found for this student.');
    }

    if (payload.options.recordingMode === 'FULL') {
      const sessionRows = payload.recordingAttendance?.sessionRows ?? [];
      drawSection(sectionLabels.recDetail, `${sessionRows.length} session(s)`, C.secDet);
      if (sessionRows.length > 0) {
        renderBadgeTable(
          {
            head: [[TABLE_LABELS.recordingTitle, TABLE_LABELS.startedAt, TABLE_LABELS.ended, TABLE_LABELS.watched, TABLE_LABELS.status]],
            body: sessionRows.map((r) => [
              safeText(r.title),
              fmtDateTime(r.startedAt),
              fmtDateTime(r.endedAt),
              fmtDuration(r.watchedSec || 0),
              safeText(r.status),
            ]),
            columnStyles: {
              0: { cellWidth: 52 },
              1: { cellWidth: 40 },
              2: { cellWidth: 40 },
              3: { cellWidth: 22, halign: 'center' },
              4: { cellWidth: 28, halign: 'center' },
            },
          },
          C.tblDet, 4, recordingStatusColors, 11,
        );
      } else {
        drawEmptyState('No recording session details found.');
      }
    }
  }

  if (
    !payload.options.includePayments &&
    !payload.options.includePhysicalAttendance &&
    !payload.options.includeRecordingAttendance
  ) {
    drawSection('No Sections Selected', undefined, C.slate);
    drawEmptyState('Select at least one section before exporting.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER — every page
  // ─────────────────────────────────────────────────────────────────────────

  const pageCount = doc.getNumberOfPages();
  const fLeft   = payload.footer?.left   ?? `Class: ${safeText(payload.classInfo.name)}`;
  const fCenter = payload.footer?.center ?? studentName;

  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);

    doc.setFillColor(...C.hdrBlue);
    doc.rect(0, PH - 12, PW, 1.5, 'F');

    doc.setFillColor(243, 246, 252);
    doc.rect(0, PH - 10.5, PW, 10.5, 'F');

    doc.setFillColor(...C.hdrBlue);
    doc.rect(0, PH - 10.5, 3, 10.5, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.textMuted);
    doc.text(normalizeText(fLeft), 9, PH - 4);
    doc.text(normalizeText(fCenter), PW / 2, PH - 4, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.hdrBlue);
    doc.text(`${p} / ${pageCount}`, PW - 9, PH - 4, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.textMuted);
    doc.text('Page', PW - 9 - 8, PH - 4, { align: 'right' });
  }

  return doc.output('blob');
}

// ─── Utility Exports ──────────────────────────────────────────────────────────

export function normalizeDateLabel(
  year: number,
  month: number,
  name?: string,
): string {
  if (name?.trim()) return name.trim();
  const d = new Date(year, month - 1, 1);
  return Number.isNaN(d.getTime())
    ? `${year}-${String(month).padStart(2, '0')}`
    : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function normalizePhysicalDate(dateText: string): string {
  if (!dateText) return '—';
  const d = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateText : fmtDate(d.toISOString());
}