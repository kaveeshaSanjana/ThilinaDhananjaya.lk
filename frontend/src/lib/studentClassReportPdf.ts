import api from './api';
import easyEnglishPdfHeader from '../assets/easy-english-pdf-header.png';

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
    rows: Array<{ date: string; session: string; sessionTime: string; status: string }>;
  };
  recordingAttendance?: {
    summaryRows: Array<{ title: string; month: string; sessions: number; watchedSec: number; lastWatchedAt?: string | null }>;
    sessionRows: Array<{ title: string; startedAt?: string; endedAt?: string | null; watchedSec: number; status: string }>;
  };
}

// ─── Sinhala Font ─────────────────────────────────────────────────────────────

const SINHALA_FONT_URL = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansSinhala/NotoSansSinhala-Regular.ttf';
const SINHALA_FONT_NAME = 'NotoSansSinhala';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary);
}

async function registerSinhalaFont(doc: any): Promise<boolean> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(SINHALA_FONT_URL, { signal: controller.signal });
    clearTimeout(tid);
    if (!response.ok) return false;
    const base64Font = arrayBufferToBase64(await response.arrayBuffer());
    const fileName = `${SINHALA_FONT_NAME}.ttf`;
    let alreadyRegistered = false;
    try { alreadyRegistered = Boolean((doc as any).getFileFromVFS?.(fileName)); } catch { alreadyRegistered = false; }
    if (!alreadyRegistered) {
      doc.addFileToVFS(fileName, base64Font);
      doc.addFont(fileName, SINHALA_FONT_NAME, 'normal');
      doc.addFont(fileName, SINHALA_FONT_NAME, 'bold');
    }
    return true;
  } catch { return false; }
}

// ─── Bilingual Section Labels (Sinhala / English) ────────────────────────────
// NOTE: Table content (dynamic data) is ALWAYS English-only for clarity.
// Section headers use bilingual labels when Sinhala font is available.

// Table column headers — always English only (avoids Sinhala rendering ugliness in table cells)
const TABLE_LABELS = {
  month: 'Month', status: 'Status', slips: 'Slips', latestSlip: 'Latest Slip',
  date: 'Date', session: 'Session', time: 'Time', total: 'Total', present: 'Present',
  late: 'Late', absent: 'Absent', excused: 'Excused', attendancePct: 'Attendance %',
  recordingTitle: 'Recording', sessions: 'Sessions', watchedTime: 'Watched',
  lastWatch: 'Last Watched', started: 'Started', ended: 'Ended', watched: 'Watched',
} as const;

// ─── Formatters ───────────────────────────────────────────────────────────────

type RGB = [number, number, number];

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    '  ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Formats attendance date — handles plain "YYYY-MM-DD" without UTC shift.
 * Also handles numeric day-only values that come pre-formatted from the server.
 */
function fmtAttendanceDate(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '' || raw === '—') return '—';
  const s = raw.trim();
  // Full ISO date YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  // Full ISO datetime
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return fmtDate(s);
  }
  // Pure numeric (day only, e.g. "13" or "19") — return as-is; caller should provide full dates
  return s;
}

/** Formats session time — suppresses meaningless "00:00" values */
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

/**
 * Cleans raw session names: formats ISO dates, humanises system tokens.
 */
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
  return String(value || '').replace(/â€"|â€"/g, '-').replace(/â€œ|â€/g, '"').replace(/â€˜|â€™/g, "'").replace(/Â/g, '');
}

function safeText(value: string | null | undefined, fallback = '—'): string {
  return normalizeText(value).trim() || fallback;
}

function cleanFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

function initialsFromName(name: string): string {
  return name.split(' ').map(p => p.trim()).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || 'ST';
}

function resolveAssetUrl(rawUrl?: string): string {
  const value = (rawUrl || '').trim();
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith('//')) return `${window.location.protocol}${value}`;
  const apiBase = typeof api.defaults.baseURL === 'string' ? api.defaults.baseURL : '';
  let origin = window.location.origin;
  if (/^https?:\/\//i.test(apiBase)) { try { origin = new URL(apiBase).origin; } catch { /**/ } }
  if (value.startsWith('/')) return `${origin}${value}`;
  return `${origin}/${value.replace(/^\/+/, '')}`;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => { if (typeof reader.result === 'string') resolve(reader.result); else reject(new Error('Failed')); };
    reader.onerror = () => reject(new Error('Failed'));
    reader.readAsDataURL(blob);
  });
}

async function loadImage(rawUrl?: string | null): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  const resolved = resolveAssetUrl(rawUrl || '');
  if (!resolved) return null;
  try {
    if (/^data:image\//i.test(resolved)) return { dataUrl: resolved, format: resolved.toLowerCase().startsWith('data:image/png') ? 'PNG' : 'JPEG' };
    const targetUrl = new URL(resolved, window.location.origin);
    if (targetUrl.origin !== window.location.origin) return null;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(targetUrl.toString(), { credentials: 'include', signal: controller.signal, headers: { Accept: 'image/*' } });
    clearTimeout(tid);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return { dataUrl: await blobToDataUrl(blob), format: blob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG' };
  } catch { return null; }
}

// ─── Status Badge Colors ──────────────────────────────────────────────────────

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
  if (v === 'WATCHED' || v === 'COMPLETED')     return { bg: [220, 252, 231], text: [22, 101, 52],  label: 'Watched'   };
  if (v === 'PARTIAL')                          return { bg: [255, 237, 213], text: [154, 52, 18],  label: 'Partial'   };
  if (v === 'NOT_WATCHED' || v === 'UNWATCHED') return { bg: [254, 226, 226], text: [153, 27, 27],  label: 'Unwatched' };
  return { bg: [241, 245, 249], text: [71, 85, 105], label: v || '—' };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createStudentClassReportFileName(studentName: string, instituteId?: string | null): string {
  const suffix = instituteId ? `${studentName}-${instituteId}` : studentName;
  return cleanFileName(`Student-Report-${suffix}.pdf`);
}

export async function buildStudentClassReportPdf(payload: StudentClassReportPayload): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();

  const sinhalaLoaded = await registerSinhalaFont(doc);
  // SF is used ONLY for section headers (bilingual). Table cells always use 'helvetica'.
  const SF = sinhalaLoaded ? SINHALA_FONT_NAME : 'helvetica';

  const C = {
    pageBg:    [247, 248, 250] as RGB,
    white:     [255, 255, 255] as RGB,
    cardBdr:   [209, 213, 219] as RGB,
    rowAlt:    [249, 250, 252] as RGB,
    hdrBg:     [17, 24, 39]   as RGB,
    hdrBlue:   [37, 99, 235]  as RGB,
    secPay:    [79, 70, 229]  as RGB,
    secPhy:    [5, 150, 105]  as RGB,
    secRec:    [217, 119, 6]  as RGB,
    secDet:    [124, 58, 237] as RGB,
    tblPay:    [79, 70, 229]  as RGB,
    tblPhy:    [5, 150, 105]  as RGB,
    tblRec:    [217, 119, 6]  as RGB,
    tblDet:    [124, 58, 237] as RGB,
    textDark:  [15, 23, 42]   as RGB,
    textMuted: [107, 114, 128] as RGB,
    green:     [22, 163, 74]  as RGB,
    red:       [220, 38, 38]  as RGB,
    amber:     [202, 138, 4]  as RGB,
    blue:      [37, 99, 235]  as RGB,
    slate:     [71, 85, 105]  as RGB,
  };

  const studentName = safeText(payload.student.fullName || payload.student.email || 'Student', 'Student');

  // Section labels: bilingual heading / English subtext
  const sectionLabels = {
    payments:  sinhalaLoaded ? 'ගෙවීම් ඉතිහාසය  /  Payments History'      : 'Payments History',
    physical:  sinhalaLoaded ? 'භෞතික පැමිණීම  /  Physical Attendance'     : 'Physical Attendance',
    recording: sinhalaLoaded ? 'පටිගත නැරඹීම  /  Recording Attendance'     : 'Recording Attendance',
    recDetail: sinhalaLoaded ? 'සැසි විස්තර  /  Recording Session Details' : 'Recording Session Details',
  };

  const preferredLetterheadUrl = payload.letterheadUrl || easyEnglishPdfHeader;
  const [avatarImage, letterheadImage] = await Promise.all([
    loadImage(payload.student.avatarUrl),
    loadImage(preferredLetterheadUrl),
  ]);

  // Measure letterhead height once so we can reuse on every page
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

  // ── Build class label from classInfo ──────────────────────────────────────
  const buildClassLabel = (): string => {
    const cn = safeText(payload.classInfo.name);
    const sj = safeText(payload.classInfo.subject);
    if (cn === '—' && sj === '—') return '';
    if (cn === '—') return sj;
    if (sj === '—' || sj.toLowerCase() === cn.toLowerCase()) return cn;
    return `${cn}  ·  ${sj}`;
  };

  // ── Page background + repeated header drawn on every page ──────────────────
  const paintPage = (pageNum: number) => {
    // Full-page background
    doc.setFillColor(...C.pageBg);
    doc.rect(0, 0, PW, PH, 'F');

    if (letterheadImage) {
      // Letterhead on EVERY page
      doc.addImage(letterheadImage.dataUrl, letterheadImage.format, 0, 0, PW, letterheadH);

      // Blue separator line under letterhead
      doc.setFillColor(...C.hdrBlue);
      doc.rect(0, letterheadH, PW, 1.2, 'F');

      // Sub-bar with student name + generated date (page 1) or just student name (other pages)
      const sY = letterheadH + 1.2, sH = 10.5, sTextY = sY + 7;
      doc.setFillColor(244, 246, 250);
      doc.rect(0, sY, PW, sH, 'F');

      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...C.textDark);
      doc.text(studentName, 16, sTextY);

      const cl = buildClassLabel();
      if (cl) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.textMuted);
        doc.text(normalizeText(cl), PW / 2, sTextY, { align: 'center' });
      }

      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.textMuted);
      if (pageNum === 1) {
        doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, PW - 16, sTextY, { align: 'right' });
      } else {
        doc.text(`Page ${pageNum}`, PW - 16, sTextY, { align: 'right' });
      }
    } else {
      // Dark header banner — only page 1 gets the full tall banner; subsequent pages get a slim strip
      if (pageNum === 1) {
        doc.setFillColor(...C.hdrBg);
        doc.rect(0, 0, PW, 52, 'F');
        doc.setFillColor(...C.hdrBlue);
        doc.rect(0, 0, PW, 2.5, 'F');
        doc.rect(0, 49.5, PW, 2.5, 'F');

        doc.setFillColor(255, 255, 255);
        doc.setGState(new (doc as any).GState({ opacity: 0.04 }));
        doc.circle(PW + 5, -5, 52, 'F');
        doc.circle(-5, 52, 36, 'F');
        doc.setGState(new (doc as any).GState({ opacity: 1 }));

        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(148, 163, 184);
        doc.text('STUDENT REPORT', 16, 11);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(255, 255, 255);
        doc.text(studentName, 16, 26);
        doc.setFont(SF, 'normal'); doc.setFontSize(9); doc.setTextColor(147, 197, 253);
        doc.text(normalizeText(buildClassLabel() || 'Student Progress Report'), 16, 34);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
        doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, PW - 16, 11, { align: 'right' });
        doc.setFont(SF, 'bold'); doc.setFontSize(8); doc.setTextColor(147, 197, 253);
        doc.text(includedSections.length > 0 ? includedSections.join('  ·  ') : 'No sections selected', PW - 16, 34, { align: 'right' });
      } else {
        // Slim continuation header
        doc.setFillColor(...C.hdrBg);
        doc.rect(0, 0, PW, 14, 'F');
        doc.setFillColor(...C.hdrBlue);
        doc.rect(0, 0, PW, 2, 'F');
        doc.rect(0, 12, PW, 2, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
        doc.text(studentName, 16, 9);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
        doc.text(`Page ${pageNum}`, PW - 16, 9, { align: 'right' });
      }
    }
  };

  // Paint page 1
  paintPage(1);

  // ── New page helper — paints background + header on each new page ──────────
  const newPage = () => {
    doc.addPage();
    const pn = doc.getNumberOfPages();
    paintPage(pn);
    // Content starts below header
    y = letterheadImage ? letterheadH + 1.2 + 10.5 + 8 : 22;
  };

  const ensureSpace = (n: number) => { if (y + n > PH - 16) newPage(); };

  // Set initial y after header
  if (letterheadImage) {
    y = letterheadH + 1.2 + 10.5 + 9;
  } else {
    y = 60;
  }

  // ── Section header: coloured pill with left accent bar ────────────────────
  const drawSection = (title: string, subtitle: string | undefined, colour: RGB) => {
    ensureSpace(16);
    const H = 10;
    doc.setFillColor(...C.white);
    doc.setDrawColor(...colour);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, y, PW - 28, H, 2, 2, 'FD');
    doc.setFillColor(...colour);
    doc.roundedRect(14, y, 4, H, 2, 0, 'F');
    doc.rect(16.5, y, 1.5, H, 'F');
    // Title — use SF only for bilingual text; it handles mixed Sinhala+English well
    doc.setFont(SF, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...colour);
    doc.text(normalizeText(title), 22, y + 6.7);
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.textMuted);
      doc.text(normalizeText(subtitle), PW - 16, y + 6.7, { align: 'right' });
    }
    doc.setTextColor(...C.textDark);
    y += H + 5;
  };

  const drawEmptyState = (msg: string) => {
    ensureSpace(12);
    doc.setFillColor(250, 251, 252);
    doc.setDrawColor(...C.cardBdr);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, y, PW - 28, 9, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.textMuted);
    doc.text(normalizeText(msg), PW / 2, y + 6.2, { align: 'center' });
    y += 14;
  };

  const drawStatRow = (items: Array<{ label: string; value: string; color: RGB }>) => {
    ensureSpace(22);
    const n = items.length;
    const gap = 3;
    const cardW = (PW - 28 - gap * (n - 1)) / n;
    const cardH = 17;
    items.forEach((item, i) => {
      const cx = 14 + i * (cardW + gap);
      doc.setFillColor(0, 0, 0);
      doc.setGState(new (doc as any).GState({ opacity: 0.03 }));
      doc.roundedRect(cx + 0.5, y + 0.5, cardW, cardH, 2, 2, 'F');
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
      doc.setFillColor(...C.white);
      doc.setDrawColor(...C.cardBdr);
      doc.setLineWidth(0.3);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'FD');
      doc.setFillColor(...item.color);
      doc.roundedRect(cx, y, cardW, 2.5, 2, 0, 'F');
      doc.rect(cx, y + 1.2, cardW, 1.3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...item.color);
      doc.text(item.value, cx + cardW / 2, y + 10.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.textMuted);
      doc.text(item.label.toUpperCase(), cx + cardW / 2, y + 14.5, { align: 'center' });
    });
    y += cardH + 5;
  };

  // All tables use 'helvetica' — NO Sinhala font in table cells (dynamic data is English only)
  const renderTable = (config: Record<string, any>, hdrColor: RGB, gap = 6) => {
    const sy = y;
    autoTable(doc, {
      ...config, startY: y, margin: { left: 14, right: 14 }, theme: 'striped',
      styles: {
        fontSize: 8.5, cellPadding: 3, textColor: [...C.textDark],
        overflow: 'linebreak', lineWidth: 0, font: 'helvetica',
      },
      headStyles: {
        fillColor: [...hdrColor], textColor: [255, 255, 255], fontStyle: 'bold',
        font: 'helvetica', fontSize: 8.5, cellPadding: 3.5,
      },
      alternateRowStyles: { fillColor: [...C.rowAlt] },
      tableLineColor: [...C.cardBdr], tableLineWidth: 0.3,
    });
    y = ((doc as any).lastAutoTable?.finalY ?? sy) + gap;
  };

  const renderBadgeTable = (
    config: Record<string, any>, hdrColor: RGB, badgeCol: number,
    colorFn: (v: string) => { bg: RGB; text: RGB; label: string }, gap = 6,
  ) => {
    const sy = y;
    autoTable(doc, {
      ...config, startY: y, margin: { left: 14, right: 14 }, theme: 'striped',
      styles: {
        fontSize: 8.5, cellPadding: 3, textColor: [...C.textDark],
        overflow: 'linebreak', lineWidth: 0, font: 'helvetica',
      },
      headStyles: {
        fillColor: [...hdrColor], textColor: [255, 255, 255], fontStyle: 'bold',
        font: 'helvetica', fontSize: 8.5, cellPadding: 3.5,
      },
      alternateRowStyles: { fillColor: [...C.rowAlt] },
      tableLineColor: [...C.cardBdr], tableLineWidth: 0.3,
      didDrawCell: (data: any) => {
        if (data.section !== 'body' || data.column.index !== badgeCol) return;
        const col = colorFn(String(data.cell.raw || ''));
        const { x, y: cy, width, height } = data.cell;
        const bW = Math.min(width - 6, 26), bH = 5.5;
        const bX = x + (width - bW) / 2, bY = cy + (height - bH) / 2;
        doc.setFillColor(...col.bg);
        doc.roundedRect(bX, bY, bW, bH, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...col.text);
        doc.text(col.label, bX + bW / 2, bY + bH / 2 + 1.1, { align: 'center' });
      },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? sy) + gap;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STUDENT INFO CARD
  // ─────────────────────────────────────────────────────────────────────────

  const CARD_H = 46;
  doc.setFillColor(0, 0, 0);
  doc.setGState(new (doc as any).GState({ opacity: 0.04 }));
  doc.roundedRect(14.5, y + 1, PW - 29, CARD_H, 3, 3, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.cardBdr);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, y, PW - 28, CARD_H, 3, 3, 'FD');

  doc.setFillColor(...C.hdrBlue);
  doc.roundedRect(14, y, 4, CARD_H, 2.5, 0, 'F');
  doc.rect(17, y, 1, CARD_H, 'F');

  const avX = 24, avY = y + 9, avR = 13;
  if (avatarImage) {
    doc.addImage(avatarImage.dataUrl, avatarImage.format, avX, avY, avR * 2, avR * 2);
    doc.setDrawColor(...C.cardBdr); doc.setLineWidth(1.2);
    doc.circle(avX + avR, avY + avR, avR, 'S');
  } else {
    doc.setFillColor(...C.hdrBlue);
    doc.circle(avX + avR, avY + avR, avR, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C.white);
    doc.text(initialsFromName(studentName), avX + avR, avY + avR + 2.5, { align: 'center' });
  }

  const tx = avX + avR * 2 + 7;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C.textDark);
  doc.text(studentName, tx, y + 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.textMuted);
  doc.text(`ID: ${safeText(payload.student.userId)}`, tx, y + 21);
  doc.text(`Email: ${safeText(payload.student.email)}`, tx, y + 27);
  doc.text(`Phone: ${safeText(payload.student.phone)}`, tx, y + 33);
  doc.text(`Institute ID: ${safeText(payload.student.instituteId)}`, tx, y + 39);

  const rx = PW - 55;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.textMuted);
  doc.text('Payment Type', rx, y + 15);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.textDark);
  doc.text(safeText(payload.student.paymentType), rx, y + 21);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.textMuted);
  doc.text('Monthly Fee', rx, y + 28);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.textDark);
  doc.text(`Rs. ${(payload.student.effectiveMonthlyFee || 0).toLocaleString()}`, rx, y + 34);

  y += CARD_H + 10;

  // ─────────────────────────────────────────────────────────────────────────
  // PAYMENTS
  // ─────────────────────────────────────────────────────────────────────────

  if (payload.options.includePayments) {
    const rows = payload.payments?.rows ?? [];
    drawSection(sectionLabels.payments, `${rows.length} record(s)`, C.secPay);
    if (rows.length > 0) {
      drawStatRow([
        { label: 'Paid',    value: String(payload.payments?.paidCount    ?? 0), color: C.green },
        { label: 'Pending', value: String(payload.payments?.pendingCount ?? 0), color: C.amber },
        { label: 'Unpaid',  value: String(payload.payments?.unpaidCount  ?? 0), color: C.red   },
      ]);
      renderBadgeTable({
        head: [[TABLE_LABELS.month, TABLE_LABELS.status, TABLE_LABELS.slips, TABLE_LABELS.latestSlip]],
        body: rows.map(r => [
          safeText(r.label),
          safeText(r.status),
          String(r.slipCount || 0),
          r.latestSlipStatus ? paymentStatusColors(r.latestSlipStatus).label : '—',
        ]),
        columnStyles: {
          0: { cellWidth: 44 },
          1: { cellWidth: 38, halign: 'center' },
          2: { cellWidth: 22, halign: 'center' },
          3: { cellWidth: 38, halign: 'center' },
        },
      }, C.tblPay, 1, paymentStatusColors, 10);
    } else { drawEmptyState('No payment records found for this student.'); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHYSICAL ATTENDANCE
  // ─────────────────────────────────────────────────────────────────────────

  if (payload.options.includePhysicalAttendance) {
    const summary = payload.physicalAttendance?.summary;
    const pct = summary?.percentage ?? 0;
    drawSection(sectionLabels.physical, `Attendance rate: ${pct}%`, C.secPhy);
    drawStatRow([
      { label: 'Total',   value: String(summary?.total   ?? 0), color: C.slate },
      { label: 'Present', value: String(summary?.present ?? 0), color: C.green },
      { label: 'Late',    value: String(summary?.late    ?? 0), color: C.amber },
      { label: 'Absent',  value: String(summary?.absent  ?? 0), color: C.red   },
      { label: 'Excused', value: String(summary?.excused ?? 0), color: C.blue  },
    ]);
    const rows = payload.physicalAttendance?.rows ?? [];
    if (rows.length > 0) {
      renderBadgeTable({
        head: [[TABLE_LABELS.date, TABLE_LABELS.session, TABLE_LABELS.time, TABLE_LABELS.status]],
        body: rows.map(r => [
          fmtAttendanceDate(r.date),
          cleanSessionLabel(r.session),
          fmtSessionTime(r.sessionTime),
          safeText(r.status),
        ]),
        columnStyles: {
          0: { cellWidth: 36 },
          1: { cellWidth: 54 },
          2: { cellWidth: 24, halign: 'center' },
          3: { cellWidth: 30, halign: 'center' },
        },
      }, C.tblPhy, 3, attendanceStatusColors, 10);
    } else { drawEmptyState('No physical attendance records found.'); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RECORDING ATTENDANCE
  // ─────────────────────────────────────────────────────────────────────────

  if (payload.options.includeRecordingAttendance) {
    const summaryRows = payload.recordingAttendance?.summaryRows ?? [];
    drawSection(sectionLabels.recording, `${summaryRows.length} recording(s) tracked`, C.secRec);
    if (summaryRows.length > 0) {
      renderTable({
        head: [[TABLE_LABELS.recordingTitle, TABLE_LABELS.month, TABLE_LABELS.sessions, TABLE_LABELS.watchedTime, TABLE_LABELS.lastWatch]],
        body: summaryRows.map(r => [
          safeText(r.title),
          safeText(r.month),
          String(r.sessions || 0),
          fmtDuration(r.watchedSec || 0),
          fmtDateTime(r.lastWatchedAt),
        ]),
        columnStyles: {
          0: { cellWidth: 52 },
          1: { cellWidth: 22 },
          2: { cellWidth: 18, halign: 'center' },
          3: { cellWidth: 24, halign: 'center' },
          4: { cellWidth: 38 },
        },
      }, C.tblRec, 8);
    } else { drawEmptyState('No recording activity found for this student.'); }

    if (payload.options.recordingMode === 'FULL') {
      const sessionRows = payload.recordingAttendance?.sessionRows ?? [];
      drawSection(sectionLabels.recDetail, `${sessionRows.length} session(s)`, C.secDet);
      if (sessionRows.length > 0) {
        renderBadgeTable({
          head: [[TABLE_LABELS.recordingTitle, TABLE_LABELS.started, TABLE_LABELS.ended, TABLE_LABELS.watched, TABLE_LABELS.status]],
          body: sessionRows.map(r => [
            safeText(r.title),
            fmtDateTime(r.startedAt),
            fmtDateTime(r.endedAt),
            fmtDuration(r.watchedSec || 0),
            safeText(r.status),
          ]),
          columnStyles: {
            0: { cellWidth: 46 },
            1: { cellWidth: 34 },
            2: { cellWidth: 34 },
            3: { cellWidth: 20, halign: 'center' },
            4: { cellWidth: 26, halign: 'center' },
          },
        }, C.tblDet, 4, recordingStatusColors, 10);
      } else { drawEmptyState('No recording session details found.'); }
    }
  }

  if (!payload.options.includePayments && !payload.options.includePhysicalAttendance && !payload.options.includeRecordingAttendance) {
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

    // Footer bar
    doc.setFillColor(...C.hdrBlue);
    doc.rect(0, PH - 11, PW, 0.9, 'F');
    doc.setFillColor(244, 246, 250);
    doc.rect(0, PH - 10.1, PW, 10.1, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.textMuted);
    doc.text(normalizeText(fLeft), 16, PH - 4);
    doc.text(normalizeText(fCenter), PW / 2, PH - 4, { align: 'center' });
    doc.text(`Page ${p} / ${pageCount}`, PW - 16, PH - 4, { align: 'right' });
  }

  return doc.output('blob');
}

// ─── Utility Exports ──────────────────────────────────────────────────────────

export function normalizeDateLabel(year: number, month: number, name?: string): string {
  if (name?.trim()) return name.trim();
  const d = new Date(year, month - 1, 1);
  return Number.isNaN(d.getTime()) ? `${year}-${String(month).padStart(2, '0')}` : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function normalizePhysicalDate(dateText: string): string {
  if (!dateText) return '—';
  const d = new Date(`${dateText}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateText : fmtDate(d.toISOString());
}