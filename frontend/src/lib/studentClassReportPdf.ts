import api from './api';
import easyEnglishPdfHeader from '../assets/easy-english-pdf-header.png';
import notoSansSinhalaUrl from '../assets/fonts/NotoSansSinhala.ttf?url';
import attendanceBannerUrl from '../assets/banners/pycycleattendancebanner.png?url';
import recordingBannerUrl from '../assets/banners/recordinghistorybanner.png?url';
import liveClassBannerUrl from '../assets/banners/liveclassbanner.png?url';
import footerBannerUrl from '../assets/banners/footer.png?url';

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
    includeLiveAttendance: boolean;
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
    summaryRows: Array<{
      title: string;
      month: string;
      sessions: number;
      watchedSec: number;
      sessionTimeSec: number;
      videoDuration: number | null;
      lastWatchedAt?: string | null;
    }>;
    sessionRows: Array<{ title: string; startedAt?: string; endedAt?: string | null; watchedSec: number; status: string }>;
  };
  liveAttendance?: {
    rows: Array<{ title: string; liveDate: string | null; status: string; joinedAt: string | null }>;
  };
}

// ─── Sinhala Font ─────────────────────────────────────────────────────────────
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
    try { alreadyRegistered = Boolean((doc as any).getFileFromVFS?.(fileName)); } catch { alreadyRegistered = false; }

    if (!alreadyRegistered) {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 12_000);
      const response = await fetch(notoSansSinhalaUrl, { signal: controller.signal });
      clearTimeout(tid);
      if (!response.ok) return false;
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (!((bytes[0] === 0x00 && bytes[1] === 0x01) || (bytes[0] === 0x74 && bytes[1] === 0x72))) return false;
      const base64Font = arrayBufferToBase64(buffer);
      doc.addFileToVFS(fileName, base64Font);
      doc.addFont(fileName, SINHALA_FONT_NAME, 'normal');
      doc.addFont(fileName, SINHALA_FONT_NAME, 'bold');
    }
    return true;
  } catch { return false; }
}

// ─── Table Column Labels ──────────────────────────────────────────────────────
const TABLE_LABELS = {
  month: 'Month', status: 'Status', slips: 'Slips', latestSlip: 'Latest Slip',
  date: 'Date', session: 'Session', time: 'Time', week: 'Week',
  recordingTitle: 'Video', videoDuration: 'Video Time', watchedTime: 'Watched', engagingTime: 'Engaging Time',
  sessions: 'Sessions', lastWatch: 'Last Watched', started: 'Started', ended: 'Ended', watched: 'Watched',
  liveClass: 'Live Class', liveDate: 'Date', liveStatus: 'Status', liveTime: 'Time',
} as const;

// ─── Formatters ───────────────────────────────────────────────────────────────
type RGB = [number, number, number];

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    '  ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
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
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtAttendanceDate(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '' || raw === '—') return '—';
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
    .replace(/â€"|â€"/g, '-').replace(/â€œ|â€/g, '"')
    .replace(/â€˜|â€™/g, "'").replace(/Â/g, '');
}

function safeText(value: string | null | undefined, fallback = '—'): string {
  return normalizeText(value).trim() || fallback;
}

function cleanFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

function initialsFromName(name: string): string {
  return (
    name.split(' ').map((p) => p.trim()).filter(Boolean)
      .slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || 'ST'
  );
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
    if (/^data:image\//i.test(resolved))
      return { dataUrl: resolved, format: resolved.toLowerCase().startsWith('data:image/png') ? 'PNG' : 'JPEG' };
    const targetUrl = new URL(resolved, window.location.origin);
    // Allow both the frontend origin and the API server origin (avatars are served from the API host)
    const apiBase = typeof api.defaults.baseURL === 'string' ? api.defaults.baseURL : '';
    let apiOrigin = window.location.origin;
    if (/^https?:\/\//i.test(apiBase)) { try { apiOrigin = new URL(apiBase).origin; } catch { /**/ } }
    if (targetUrl.origin !== window.location.origin && targetUrl.origin !== apiOrigin) return null;
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

// Loads a Vite-bundled local asset (banner/footer PNG) and computes display height in mm
type BannerAsset = { dataUrl: string; format: 'PNG'; h: number };

async function loadBannerAsset(url: string, displayWidthMm: number): Promise<BannerAsset | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const dataUrl = await blobToDataUrl(blob);
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    const h = Math.min(38, Math.max(10, displayWidthMm * (dims.h / dims.w)));
    return { dataUrl, format: 'PNG', h };
  } catch { return null; }
}



function attendanceStatusColors(raw: string | null | undefined): { bg: RGB; text: RGB; label: string } {
  const v = (raw || '').trim().toUpperCase();
  if (v === 'PRESENT') return { bg: [220, 252, 231], text: [22, 101, 52], label: 'Present' };
  if (v === 'LATE') return { bg: [255, 237, 213], text: [154, 52, 18], label: 'Late' };
  if (v === 'ABSENT') return { bg: [254, 226, 226], text: [153, 27, 27], label: 'Absent' };
  if (v === 'EXCUSED') return { bg: [224, 242, 254], text: [14, 116, 163], label: 'Excused' };
  return { bg: [241, 245, 249], text: [71, 85, 105], label: v || '—' };
}

function recordingStatusColors(raw: string | null | undefined): { bg: RGB; text: RGB; label: string } {
  const v = (raw || '').trim().toUpperCase();
  if (v === 'WATCHED' || v === 'COMPLETED') return { bg: [220, 252, 231], text: [22, 101, 52], label: 'Watched' };
  if (v === 'PARTIAL') return { bg: [255, 237, 213], text: [154, 52, 18], label: 'Partial' };
  if (v === 'NOT_WATCHED' || v === 'UNWATCHED') return { bg: [254, 226, 226], text: [153, 27, 27], label: 'Unwatched' };
  return { bg: [241, 245, 249], text: [71, 85, 105], label: v || '—' };
}

// ─── Public API ───────────────────────────────────────────────────────────────
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
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();

  const sinhalaLoaded = await registerSinhalaFont(doc);
  const SF = sinhalaLoaded ? SINHALA_FONT_NAME : 'helvetica';

  // ── Color Palette ───────────────────────────────────────────────────────────
  const C = {
    pageBg:    [255, 255, 255] as RGB,
    white:     [255, 255, 255] as RGB,
    cardBdr:   [208, 220, 238] as RGB,
    rowAlt:    [248, 249, 250] as RGB,
    hdrBg:     [11, 15, 42]   as RGB,
    hdrBlue:   [79, 70, 229]  as RGB,
    hdrAccent: [165, 180, 252] as RGB,
    hdrMuted:  [100, 116, 145] as RGB,
    secPay:    [5, 150, 105]  as RGB,
    secPhy:    [109, 40, 217] as RGB,
    secRec:    [217, 119, 6]  as RGB,
    secDet:    [124, 58, 237] as RGB,
    tblPay:    [4, 120, 87]   as RGB,
    tblPhy:    [109, 40, 217] as RGB,
    tblRec:    [180, 95, 6]   as RGB,
    tblDet:    [109, 40, 217] as RGB,
    tblLive:   [220, 38, 38]  as RGB,
    secLive:   [185, 28, 28]  as RGB,
    textDark:  [12, 18, 50]   as RGB,
    textMuted: [90, 108, 138] as RGB,
    textLight: [148, 163, 192] as RGB,
    green:     [5, 150, 105]  as RGB,
    red:       [220, 38, 38]  as RGB,
    amber:     [202, 138, 4]  as RGB,
    blue:      [37, 99, 235]  as RGB,
    slate:     [71, 85, 105]  as RGB,
  };

  const studentName = safeText(payload.student.fullName || payload.student.email || 'Student', 'Student');
  const bannerW = PW - 28; // 182mm available between margins

  // ── Load all images in parallel ────────────────────────────────────────────
  const preferredLetterheadUrl = payload.letterheadUrl || easyEnglishPdfHeader;
  const [
    avatarImage,
    letterheadImage,
    attendanceBanner,
    recordingBanner,
    liveClassBanner,
    footerBanner,
  ] = await Promise.all([
    loadImage(payload.student.avatarUrl),
    loadImage(preferredLetterheadUrl),
    payload.options.includePhysicalAttendance  ? loadBannerAsset(attendanceBannerUrl, bannerW)  : Promise.resolve(null as BannerAsset | null),
    payload.options.includeRecordingAttendance ? loadBannerAsset(recordingBannerUrl, bannerW)   : Promise.resolve(null as BannerAsset | null),
    payload.options.includeLiveAttendance      ? loadBannerAsset(liveClassBannerUrl, bannerW)   : Promise.resolve(null as BannerAsset | null),
    loadBannerAsset(footerBannerUrl, PW),
  ]);

  const footerH = 10;

  // Measure letterhead
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

  // ── Page background + first-page-only header ──────────────────────────────
  const paintPage = (pageNum: number) => {
    doc.setFillColor(...C.pageBg);
    doc.rect(0, 0, PW, PH, 'F');

    if (pageNum !== 1) return; // Pages 2+ get only the background

    if (letterheadImage) {
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
      doc.text(includedSections.length > 0 ? includedSections.join('  ·  ') : 'No sections selected', PW - 14, 42, { align: 'right' });
      doc.setFillColor(...C.hdrBlue);
      doc.rect(0, 54, PW, 4, 'F');
    }
  };

  paintPage(1);

  const newPage = () => {
    doc.addPage();
    const pn = doc.getNumberOfPages();
    paintPage(pn);
    y = 14; // No header on pages 2+, start from top margin
  };

  const ensureSpace = (n: number) => {
    if (y + n > PH - footerH - 4) newPage();
  };

  y = letterheadImage ? letterheadH + 1.5 + 11 + 10 : 68;

  // ── Banner section header ──────────────────────────────────────────────────
  const drawBannerSection = (banner: BannerAsset | null, subtitle?: string) => {
    if (!banner) return;
    ensureSpace(banner.h + 8);
    doc.addImage(banner.dataUrl, banner.format, 14, y, bannerW, banner.h);
    if (subtitle) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(subtitle, PW - 18, y + banner.h - 4, { align: 'right' });
    }
    y += banner.h + 8;
  };

  // ── Text section header (for sub-sections without a banner) ───────────────
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
    styles: { fontSize: 8.5, cellPadding: 3.5, textColor: C.textDark, overflow: 'linebreak' as const, lineWidth: 0, font: 'helvetica' },
    headStyles: { fillColor: hdrColor, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, font: 'helvetica', fontSize: 8.5, cellPadding: 4 },
    alternateRowStyles: { fillColor: C.rowAlt },
    tableLineColor: C.cardBdr,
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
      ...config, startY: y, ...sharedTableStyles(hdrColor),
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
  // STUDENT INFO CARD
  // ─────────────────────────────────────────────────────────────────────────

  const showPaymentPanel = payload.options.includePayments;

  // Pre-compute last paid row for the student card panel
  const allPayRows = payload.options.includePayments ? (payload.payments?.rows ?? []) : [];
  const lastPaidRow = allPayRows.find((r) => {
    const s = (r.status || '').toUpperCase();
    return s === 'PAID' || s === 'VERIFIED';
  }) ?? allPayRows[0] ?? null;
  const CARD_H = 40;

  doc.setFillColor(0, 0, 0);
  doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
  doc.roundedRect(14.5, y + 0.5, PW - 29, CARD_H, 3, 3, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.cardBdr);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, y, PW - 28, CARD_H, 3, 3, 'FD');

  doc.setFillColor(...C.hdrBlue);
  doc.roundedRect(14, y, 4, CARD_H, 2.5, 0, 'F');
  doc.rect(16.5, y, 1.5, CARD_H, 'F');

  // Avatar — compact
  const avCx = 30, avCy = y + CARD_H / 2, avR = 9;
  if (avatarImage) {
    doc.addImage(avatarImage.dataUrl, avatarImage.format, avCx - avR, avCy - avR, avR * 2, avR * 2);
    doc.setDrawColor(...C.cardBdr);
    doc.setLineWidth(1);
    doc.circle(avCx, avCy, avR, 'S');
  } else {
    doc.setFillColor(...C.hdrAccent);
    doc.circle(avCx, avCy, avR + 1, 'F');
    doc.setFillColor(...C.hdrBlue);
    doc.circle(avCx, avCy, avR, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(initialsFromName(studentName), avCx, avCy + 2.2, { align: 'center' });
  }

  // Name + subtitle
  const infoX = avCx + avR + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.textDark);
  doc.text(studentName, infoX, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.textMuted);
  doc.text('Student Progress Report', infoX, y + 16);

  doc.setDrawColor(...C.cardBdr);
  doc.setLineWidth(0.3);
  doc.line(infoX, y + 19, PW - 57, y + 19);

  // Info rows — Student ID + Phone
  const labelX = infoX, valX = infoX + 21, rowH = 7.5;
  const infoRows: Array<[string, string]> = [
    ['Student ID', safeText(payload.student.instituteId)],
    ['Phone',      safeText(payload.student.phone)],
  ];
  infoRows.forEach(([lbl, val], idx) => {
    const ry = y + 24 + idx * rowH;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...C.textMuted);
    doc.text(lbl, labelX, ry);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.textDark);
    doc.text(val, valX, ry);
  });

  // Payment panel
  if (showPaymentPanel) {
    const panelX = PW - 54, panelW = 38, panelH = 26, panelY = y + 7;
    const unpaidCount = payload.payments?.pendingCount ?? 0;
    const midY = panelY + 5 + (panelH - 5) / 2;   // centre of content area below header

    // Shadow
    doc.setFillColor(0, 0, 0);
    doc.setGState(new (doc as any).GState({ opacity: 0.04 }));
    doc.roundedRect(panelX + 0.4, panelY + 0.4, panelW, panelH, 2.5, 2.5, 'F');
    doc.setGState(new (doc as any).GState({ opacity: 1 }));

    // Background
    doc.setFillColor(240, 241, 255);
    doc.setDrawColor(210, 214, 255);
    doc.setLineWidth(0.3);
    doc.roundedRect(panelX, panelY, panelW, panelH, 2.5, 2.5, 'FD');

    // Header strip
    doc.setFillColor(...C.hdrBlue);
    doc.roundedRect(panelX, panelY, panelW, 5, 2.5, 2.5, 'F');
    doc.rect(panelX, panelY + 2.5, panelW, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(255, 255, 255);
    doc.text('PAYMENT SUMMARY', panelX + panelW / 2, panelY + 3.6, { align: 'center' });

    const colW = panelW / 2;
    const lCx = panelX + colW / 2;
    const rCx = panelX + colW + colW / 2;

    // Left — Last Paid Month
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.hdrBlue);
    doc.text(lastPaidRow ? safeText(lastPaidRow.label) : '—', lCx, midY, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(...C.textMuted);
    doc.text('Last Paid Month', lCx, midY + 5, { align: 'center' });

    // Column divider
    doc.setDrawColor(...C.cardBdr);
    doc.setLineWidth(0.25);
    doc.line(panelX + colW, panelY + 6.5, panelX + colW, panelY + panelH - 3);

    // Right — Unpaid count
    const unpaidColor = unpaidCount > 0 ? C.red : C.green;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...unpaidColor);
    doc.text(String(unpaidCount), rCx, midY, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(...C.textMuted);
    doc.text('Unpaid Months', rCx, midY + 5, { align: 'center' });
  }

  y += CARD_H + 10;

  // Payment section removed — last paid month is shown in the student card panel above.

  // ─────────────────────────────────────────────────────────────────────────
  // PHYSICAL ATTENDANCE
  // ─────────────────────────────────────────────────────────────────────────

  if (payload.options.includePhysicalAttendance) {
    const summary = payload.physicalAttendance?.summary;
    const pct = summary?.percentage ?? 0;

    drawBannerSection(attendanceBanner, `Attendance rate: ${pct}%`);

    drawStatRow([
      { label: 'Total',   value: String(summary?.total   ?? 0), color: C.slate },
      { label: 'Present', value: String(summary?.present ?? 0), color: C.green },
      { label: 'Late',    value: String(summary?.late    ?? 0), color: C.amber },
      { label: 'Absent',  value: String(summary?.absent  ?? 0), color: C.red   },
      { label: 'Excused', value: String(summary?.excused ?? 0), color: C.blue  },
    ]);

    const rows = payload.physicalAttendance?.rows ?? [];
    const hasWeekData = rows.some((r) => Boolean(r.weekName));

    const attendanceTableConfig = (bodyRows: typeof rows, includeWeek = false) => ({
      head: [includeWeek
        ? [TABLE_LABELS.week, TABLE_LABELS.date, TABLE_LABELS.session, TABLE_LABELS.time, TABLE_LABELS.status]
        : [TABLE_LABELS.date, TABLE_LABELS.session, TABLE_LABELS.time, TABLE_LABELS.status]],
      body: bodyRows.map((r) => includeWeek
        ? [safeText(r.weekName), fmtAttendanceDate(r.date), cleanSessionLabel(r.session), fmtSessionTime(r.sessionTime), safeText(r.status)]
        : [fmtAttendanceDate(r.date), cleanSessionLabel(r.session), fmtSessionTime(r.sessionTime), safeText(r.status)]),
      columnStyles: includeWeek ? {
        0: { cellWidth: 28 },
        1: { cellWidth: 32 },
        2: { cellWidth: 70 },
        3: { cellWidth: 26, halign: 'center' as const },
        4: { cellWidth: 26, halign: 'center' as const },
      } : {
        0: { cellWidth: 40 },
        1: { cellWidth: 88 },
        2: { cellWidth: 28, halign: 'center' as const },
        3: { cellWidth: 26, halign: 'center' as const },
      },
    });

    if (rows.length > 0) {
      renderBadgeTable(attendanceTableConfig(rows, hasWeekData), C.tblPhy, hasWeekData ? 4 : 3, attendanceStatusColors, 11);
    } else {
      drawEmptyState('No physical attendance records found.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RECORDING ATTENDANCE
  // ─────────────────────────────────────────────────────────────────────────

  if (payload.options.includeRecordingAttendance) {
    const summaryRows = payload.recordingAttendance?.summaryRows ?? [];

    drawBannerSection(recordingBanner, `${summaryRows.length} recording(s) tracked`);

    if (summaryRows.length > 0) {
      renderTable(
        {
          head: [[TABLE_LABELS.recordingTitle, TABLE_LABELS.videoDuration, TABLE_LABELS.watchedTime, TABLE_LABELS.engagingTime]],
          body: summaryRows.map((r) => [
            safeText(r.title),
            r.videoDuration != null && r.videoDuration > 0 ? fmtDuration(r.videoDuration) : '—',
            fmtDuration(r.watchedSec || 0),
            fmtDuration(r.sessionTimeSec || 0),
          ]),
          columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 32, halign: 'center' as const },
            2: { cellWidth: 32, halign: 'center' as const },
            3: { cellWidth: 28, halign: 'center' as const },
          },
        },
        C.tblRec, 9,
      );
    } else {
      drawEmptyState('No recording activity found for this student.');
    }

    if (payload.options.recordingMode === 'FULL') {
      const sessionRows = payload.recordingAttendance?.sessionRows ?? [];
      const recDetailLabel = sinhalaLoaded ? 'සැසි විස්තර  /  Recording Session Details' : 'Recording Session Details';
      drawSection(recDetailLabel, `${sessionRows.length} session(s)`, C.secDet);
      if (sessionRows.length > 0) {
        renderBadgeTable(
          {
            head: [[TABLE_LABELS.recordingTitle, TABLE_LABELS.started, TABLE_LABELS.ended, TABLE_LABELS.watched, TABLE_LABELS.status]],
            body: sessionRows.map((r) => [
              safeText(r.title), fmtDateTime(r.startedAt), fmtDateTime(r.endedAt),
              fmtDuration(r.watchedSec || 0), safeText(r.status),
            ]),
            columnStyles: {
              0: { cellWidth: 52 }, 1: { cellWidth: 40 }, 2: { cellWidth: 40 },
              3: { cellWidth: 22, halign: 'center' as const }, 4: { cellWidth: 28, halign: 'center' as const },
            },
          },
          C.tblDet, 4, recordingStatusColors, 11,
        );
      } else {
        drawEmptyState('No recording session details found.');
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIVE CLASS ATTENDANCE
  // ─────────────────────────────────────────────────────────────────────────

  if (payload.options.includeLiveAttendance) {
    const liveRows = payload.liveAttendance?.rows ?? [];

    drawBannerSection(liveClassBanner, `${liveRows.filter((r) => r.status === 'JOINED').length} class(es) joined`);

    if (liveRows.length > 0) {
      renderBadgeTable(
        {
          head: [[TABLE_LABELS.liveClass, TABLE_LABELS.liveDate, TABLE_LABELS.liveStatus, TABLE_LABELS.liveTime]],
          body: liveRows.map((r) => [
            safeText(r.title),
            r.liveDate ? fmtAttendanceDate(r.liveDate) : '—',
            r.status,
            r.joinedAt ? fmtDateTime(r.joinedAt) : '—',
          ]),
          columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 36 },
            2: { cellWidth: 30, halign: 'center' as const },
            3: { cellWidth: 36 },
          },
        },
        C.tblLive, 2,
        (v) => {
          const s = (v || '').toUpperCase();
          if (s === 'JOINED') return { bg: [220, 252, 231] as RGB, text: [22, 101, 52] as RGB, label: 'Joined' };
          return { bg: [254, 226, 226] as RGB, text: [153, 27, 27] as RGB, label: 'Not Joined' };
        },
        9,
      );
    } else {
      drawEmptyState('No live class records found for this student.');
    }
  }

  if (!payload.options.includePayments && !payload.options.includePhysicalAttendance && !payload.options.includeRecordingAttendance && !payload.options.includeLiveAttendance) {
    drawSection('No Sections Selected', undefined, C.slate);
    drawEmptyState('Select at least one section before exporting.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER — every page (footer.png banner)
  // ─────────────────────────────────────────────────────────────────────────

  const pageCount = doc.getNumberOfPages();

  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);

    if (footerBanner) {
      doc.addImage(footerBanner.dataUrl, footerBanner.format, 0, PH - footerH, PW, footerH);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.textMuted);
      doc.text(`Page ${p} / ${pageCount}`, PW - 8, PH - footerH / 2 + 1.5, { align: 'right' });
    } else {
      doc.setFillColor(...C.hdrBlue);
      doc.rect(0, PH - footerH, PW, 0.8, 'F');
      doc.setFillColor(243, 246, 252);
      doc.rect(0, PH - footerH + 0.8, PW, footerH - 0.8, 'F');
      doc.setFillColor(...C.hdrBlue);
      doc.rect(0, PH - footerH + 0.8, 3, footerH - 0.8, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      const fLeft = payload.footer?.left ?? `Class: ${safeText(payload.classInfo.name)}`;
      doc.text(normalizeText(fLeft), 9, PH - 3.5);
      doc.text(normalizeText(payload.footer?.center ?? studentName), PW / 2, PH - 3.5, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.hdrBlue);
      doc.text(`${p} / ${pageCount}`, PW - 9, PH - 3.5, { align: 'right' });
    }
  }

  return doc.output('blob');
}

// ─── Utility Exports ──────────────────────────────────────────────────────────

export function normalizeDateLabel(year: number, month: number, name?: string): string {
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
