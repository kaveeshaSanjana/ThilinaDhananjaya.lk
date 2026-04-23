import api from './api';
import easyEnglishPdfHeader from '../assets/easy-english-pdf-header.png';
import notoSansSinhalaUrl from '../assets/fonts/NotoSansSinhala.ttf?url';

// ─── Section Banner Imports (Assume these paths exist) ────────────────────────
import overviewBannerUrl from '../assets/banners/overviewbanner.png';
import sessionBannerUrl from '../assets/banners/sessionbanner.png';
import timelineBannerUrl from '../assets/banners/timelinebanner.png';

const BANNER_W = 210; // full A4 width
const BANNER_H = 15;  // as specified

// ─── Types ────────────────────────────────────────────────────────────────────

type RGB = readonly [number, number, number];

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtSec(sec: number): string {
  if (!sec || sec <= 0) return '0:00';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

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

function calcRealDuration(session: any): number {
  if (!session?.endedAt || !session?.startedAt) return 0;
  return Math.max(
    0,
    Math.round(
      (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000,
    ),
  );
}

function calcActivePercent(session: any): number {
  const realSec = calcRealDuration(session);
  if (!realSec) return 0;
  return Math.min(100, Math.round(((session?.totalWatchedSec || 0) / realSec) * 100));
}

function cleanFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

<<<<<<< HEAD
// ─── Labels (bilingual) ───────────────────────────────────────────────────────

/** Shorthand: pick Sinhala or English string based on `si` flag */
function t(si: boolean, sinhala: string, english: string): string {
  return si ? sinhala : english;
}

function activityLabel(rawType: string, si: boolean): string {
  const raw = rawType.toUpperCase();
  if (raw === 'PUSH')
    return t(si, 'පැමිණීම සනාථ කළා',         'Marked Present');
  if (raw === 'INCOMPLETE_EXIT')
    return t(si, 'අඩකින් ගිය (අසම්පූර්ණ)',    'Left Early');
  if (raw === 'MANUAL')
    return t(si, 'අතින් සනාථ කළා',            'Manually Marked');
  if (raw === 'LIVE_JOIN')
    return t(si, 'සජීවීව සම්බන්ධ වූ',         'Joined Live');
  if (raw === 'START' || raw === 'PLAY' || raw === 'VIDEO_PLAY')
    return t(si, 'නැරඹීම ආරම්භ කළා',          'Started Watching');
  if (raw === 'RESUME' || raw === 'VIDEO_RESUME')
    return t(si, 'නැරඹීම නැවත ආරම්භ කළා',    'Resumed');
  if (raw === 'PAUSE' || raw === 'VIDEO_PAUSE')
    return t(si, 'විරාම කළා',                  'Paused');
  if (raw.includes('SEEK'))
    return t(si, 'ස්ථානය වෙනස් කළා',          'Seeked');
  if (raw === 'VIDEO_ENDED' || raw === 'VIDEO_END' || raw === 'ENDED')
    return t(si, 'වීඩියෝව අවසන් වූ',           'Finished');
  if (raw.includes('LEAVE') || raw.includes('LEFT') || raw.includes('CLOSE'))
    return t(si, 'ඉවත් වූ / වසා දැමූ',        'Left / Closed');
  if (raw === 'SESSION_END' || raw === 'END_SESSION' || raw === 'END')
    return t(si, 'සැසිය අවසන් වූ',             'Session Ended');
  if (raw.includes('HB') || raw === 'HEARTBEAT')
    return t(si, 'හදවත් ස්පන්දනය',            'Heartbeat');
  return rawType || t(si, 'නොදන්නා', 'Unknown');
}

function sessionStatusLabel(raw: string | undefined, si: boolean): string {
  const v = (raw || '').toUpperCase();
  if (v === 'WATCHING') return t(si, 'නරඹමින්',      'Watching');
  if (v === 'ENDED')    return t(si, 'අවසන්',         'Ended');
  if (v === 'PAUSED')   return t(si, 'විරාම',         'Paused');
  if (v === 'JOINED')   return t(si, 'සම්බන්ධ වූ',   'Joined');
=======
function normalizeText(value?: string | null): string {
  return String(value || '')
    .replace(/â€"|â€"/g, '-')
    .replace(/â€œ|â€/g, '"')
    .replace(/â€˜|â€™/g, "'")
    .replace(/Â/g, '');
}

/** Maps raw event type tokens to clean, readable English labels */
function activityLabel(rawType: string): string {
  const raw = rawType.toUpperCase();
  if (raw === 'PUSH')                              return 'Marked Present';
  if (raw === 'INCOMPLETE_EXIT')                   return 'Left Early';
  if (raw === 'MANUAL')                            return 'Manually Marked';
  if (raw === 'LIVE_JOIN')                         return 'Joined Live';
  if (raw === 'START' || raw === 'PLAY' || raw === 'VIDEO_PLAY')   return 'Started Watching';
  if (raw === 'RESUME' || raw === 'VIDEO_RESUME')  return 'Resumed';
  if (raw === 'PAUSE'  || raw === 'VIDEO_PAUSE')   return 'Paused';
  if (raw.includes('SEEK'))                        return 'Seeked';
  if (raw === 'VIDEO_ENDED' || raw === 'VIDEO_END' || raw === 'ENDED') return 'Finished';
  if (raw.includes('LEAVE') || raw.includes('LEFT') || raw.includes('CLOSE')) return 'Left / Closed';
  if (raw === 'SESSION_END' || raw === 'END_SESSION' || raw === 'END') return 'Session Ended';
  if (raw.includes('HB') || raw === 'HEARTBEAT')  return 'Heartbeat';
  return rawType || 'Unknown';
}

/** Translates raw session status to English */
function sessionStatusLabel(raw: string | undefined): string {
  const v = (raw || '').toUpperCase();
  if (v === 'WATCHING') return 'Watching';
  if (v === 'ENDED')    return 'Ended';
  if (v === 'PAUSED')   return 'Paused';
  if (v === 'JOINED')   return 'Joined';
>>>>>>> a2cb41a2ad2dd784a34981adac4663faebb6028c
  return raw || '—';
}

// ─── Utilities ────────────────────────────────────────────────────────────────

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
      else reject(new Error('Failed to convert blob to data URL'));
    };
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}

<<<<<<< HEAD
async function loadAvatarImage(
  rawUrl?: string,
): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
=======
// Handles Cross-Origin profile images
async function loadAvatarImage(rawUrl?: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
>>>>>>> a2cb41a2ad2dd784a34981adac4663faebb6028c
  const resolved = resolveAssetUrl(rawUrl);
  if (!resolved) return null;
  try {
    if (/^data:image\//i.test(resolved)) {
<<<<<<< HEAD
      return {
        dataUrl: resolved,
        format: resolved.toLowerCase().startsWith('data:image/png') ? 'PNG' : 'JPEG',
      };
    }
    const response = await fetch(resolved, { credentials: 'include' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return {
      dataUrl: await blobToDataUrl(blob),
      format: blob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG',
    };
=======
      return { dataUrl: resolved, format: resolved.toLowerCase().startsWith('data:image/png') ? 'PNG' : 'JPEG' };
    }
    const targetUrl = new URL(resolved, window.location.origin);
    const isCrossOrigin = targetUrl.origin !== window.location.origin;
    
    const fetchOpts: RequestInit = { headers: { Accept: 'image/*' } };
    if (!isCrossOrigin) fetchOpts.credentials = 'include';
    
    const response = await fetch(targetUrl.toString(), fetchOpts);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return { dataUrl: await blobToDataUrl(blob), format: blob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG' };
  } catch { 
    return null; 
  }
}

async function loadBundledImage(importedUrl: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(importedUrl, { signal: controller.signal });
    clearTimeout(tid);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return { dataUrl: await blobToDataUrl(blob), format: blob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG' };
  } catch {
    return null;
  }
}

async function loadImage(rawUrl?: string | null): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  const resolved = resolveAssetUrl(rawUrl || '');
  if (!resolved) return null;
  try {
    if (/^data:image\//i.test(resolved))
      return { dataUrl: resolved, format: resolved.toLowerCase().startsWith('data:image/png') ? 'PNG' : 'JPEG' };
    const targetUrl = new URL(resolved, window.location.origin);
    if (targetUrl.origin !== window.location.origin) return null;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(targetUrl.toString(), {
      credentials: 'include',
      signal: controller.signal,
      headers: { Accept: 'image/*' },
    });
    clearTimeout(tid);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return { dataUrl: await blobToDataUrl(blob), format: blob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG' };
>>>>>>> a2cb41a2ad2dd784a34981adac4663faebb6028c
  } catch {
    return null;
  }
}

// ─── Sinhala Font ─────────────────────────────────────────────────────────────

<<<<<<< HEAD
const SINHALA_FONT_URL =
  'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansSinhala/NotoSansSinhala-Regular.ttf';
=======
>>>>>>> a2cb41a2ad2dd784a34981adac4663faebb6028c
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
      const isTTF = (bytes[0] === 0x00 && bytes[1] === 0x01) || (bytes[0] === 0x74 && bytes[1] === 0x72);
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

type RGB = [number, number, number];

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function exportStudentWatchDetailPdf(
  data: any,
  options?: { language?: 'si' | 'en' },
): Promise<void> {
  if (!data) return;

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  // ── Data extraction ──────────────────────────────────────────────────────
  const student   = data.student    || {};
  const user      = student.user    || {};
  const profile   = user.profile    || {};
  const recording = data.recording  || {};
  const cls       = data.class      || {};
  const month     = data.month      || {};

  const sessions: any[]   = Array.isArray(student.sessions)          ? [...student.sessions].reverse() : [];
  const attDetails: any[] = Array.isArray(student.attendanceDetails) ? student.attendanceDetails        : [];
  const studentName       = profile.fullName || user.email || 'Student';

  // Build unified, time-sorted activity timeline — filter noisy heartbeats
  const allActivityEvents: any[] = [
    ...attDetails.map((e: any) => ({ ...e, _source: 'attendance' })),
    ...sessions.flatMap((session: any, idx: number) =>
      (Array.isArray(session.events) ? session.events : [])
        .filter((e: any) => {
          const ev = String(e?.type || e?.event || '').toUpperCase();
          return !ev.includes('HB') && !ev.includes('HEARTBEAT') && ev !== 'IDLE' && ev !== 'FOCUS';
        })
        .map((e: any) => ({ ...e, _source: 'session', _sessionNum: idx + 1 })),
    ),
  ].sort((a, b) => {
    const ta = new Date(a.at || a.wallTime || a.timestamp || 0).getTime();
    const tb = new Date(b.at || b.wallTime || b.timestamp || 0).getTime();
    return ta - tb;
  });

  // Load all images and banners concurrently
  const [
    avatarImage,
    letterheadImage,
    overviewBannerImage,
    sessionBannerImage,
    timelineBannerImage
  ] = await Promise.all([
    loadAvatarImage(profile.avatarUrl),
    loadImage(easyEnglishPdfHeader),
    loadBundledImage(overviewBannerUrl),
    loadBundledImage(sessionBannerUrl),
    loadBundledImage(timelineBannerUrl)
  ]);

  // ── jsPDF init ───────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW  = doc.internal.pageSize.getWidth();
  const PH  = doc.internal.pageSize.getHeight();

<<<<<<< HEAD
  // Try to load Sinhala font; fall back gracefully to helvetica
  const sinhalaLoaded = await registerSinhalaFont(doc);
  // si = true  → render Sinhala labels (only when font loaded)
  // si = false → render English labels
  const si = options?.language === 'si' ? sinhalaLoaded : false;
  // SF = "Safe Font": Sinhala-capable when loaded, otherwise helvetica
  const SF = sinhalaLoaded ? SINHALA_FONT_NAME : 'helvetica';

  // ── Colour palette ───────────────────────────────────────────────────────
  const C = {
    hdrBg:     [10, 18, 34]    as RGB,
    hdrBlue:   [8, 145, 178]   as RGB,
    secBar:    [30, 41, 59]    as RGB,
    tblHead:   [30, 41, 59]    as RGB,
    sumHead:   [13, 148, 136]  as RGB,
    white:     [255, 255, 255] as RGB,
    card:      [248, 250, 252] as RGB,
    cardBdr:   [226, 232, 240] as RGB,
    rowAlt:    [245, 247, 250] as RGB,
    pageBg:    [250, 251, 253] as RGB,
    textDark:  [15, 23, 42]    as RGB,
    textMuted: [100, 116, 139] as RGB,
    info:      [29, 78, 216]   as RGB,
    success:   [22, 163, 74]   as RGB,
    warning:   [217, 119, 6]   as RGB,
  };

  // ── Local helpers ────────────────────────────────────────────────────────
=======
  const sinhalaLoaded = await registerSinhalaFont(doc);
  const SF = sinhalaLoaded ? SINHALA_FONT_NAME : 'helvetica';

  // Unified color palette definition
  const C = {
    pageBg:      [238, 242, 250] as RGB,
    white:       [255, 255, 255] as RGB,
    cardBdr:     [208, 220, 238] as RGB,
    rowAlt:      [246, 249, 253] as RGB,
    hdrBg:       [11, 15, 42]    as RGB,
    hdrBlue:     [79, 70, 229]   as RGB, // consistent indigo primary brand
    hdrAccent:   [165, 180, 252] as RGB,
    hdrMuted:    [100, 116, 145] as RGB,
    textDark:    [12, 18, 50]    as RGB,
    textMuted:   [90, 108, 138]  as RGB,
    textLight:   [148, 163, 192] as RGB,
    info:        [29, 78, 216]   as RGB,
    success:     [22, 163, 74]   as RGB,
    warning:     [217, 119, 6]   as RGB,
    tableHead:   [30, 41, 59]    as RGB,
    summaryHead: [13, 148, 136]  as RGB,
    card:        [255, 255, 255] as RGB,
  };

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
>>>>>>> a2cb41a2ad2dd784a34981adac4663faebb6028c

  const countSessionEvents = (session: any): number => {
    if (!Array.isArray(session?.events)) return 0;
    return session.events.filter((event: any) => {
      const type = String(event?.type || event?.event || '').toUpperCase();
      return !type.includes('HB') && !type.includes('HEARTBEAT') && type !== 'IDLE' && type !== 'FOCUS';
    }).length;
  };

<<<<<<< HEAD
  let y = 60;

  const ensureSpace = (needed: number) => {
    if (y + needed <= PH - 16) return;
    doc.addPage();
    initBg();
    y = 20;
  };

  const initBg = () => {
    doc.setFillColor(...C.pageBg);
    doc.rect(0, 0, PW, PH, 'F');
  };

  // Section header bar with left accent stripe
  const drawSection = (title: string, subtitle?: string, colour: RGB = C.secBar) => {
=======
  let y = 0;

  const buildHeaderSubLabel = (): string => {
    return [cls.name, month.name, recording.title].filter(Boolean).join('  ·  ');
  };

  // Render Page background and First-Page Header
  const paintPage = (pageNum: number) => {
    doc.setFillColor(...C.pageBg);
    doc.rect(0, 0, PW, PH, 'F');

    // ONLY render the header on the first page
    if (pageNum === 1) {
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
        
        const headerSub = buildHeaderSubLabel();
        if (headerSub) {
          doc.setFont(SF, 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...C.textMuted);
          doc.text(normalizeText(headerSub), PW / 2, sTextY, { align: 'center' });
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.textMuted);
        doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, PW - 12, sTextY, { align: 'right' });
        doc.setFillColor(...C.cardBdr);
        doc.rect(0, sY + sH, PW, 0.4, 'F');
      } else {
        // Fallback Dark Hero Header if no letterhead
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

        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...C.hdrAccent);
        doc.text('STUDENT WATCH DETAIL REPORT', 14, 14.2);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.hdrMuted);
        doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, PW - 14, 14.2, { align: 'right' });

        doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(255, 255, 255);
        doc.text(studentName, 14, 32);

        const headerSub = buildHeaderSubLabel();
        doc.setFont(SF, 'normal'); doc.setFontSize(10); doc.setTextColor(...C.hdrAccent);
        doc.text(normalizeText(headerSub || 'Watch Activity'), 14, 42);

        doc.setFillColor(...C.hdrBlue);
        doc.rect(0, 54, PW, 4, 'F');
      }
    }
  };

  // Initialize page 1
  paintPage(1);
  y = letterheadImage ? letterheadH + 1.5 + 11 + 10 : 68;

  const ensureSpace = (needed: number) => {
    if (y + needed <= PH - 16) return;
    doc.addPage(); 
    const pn = doc.getNumberOfPages();
    paintPage(pn);
    y = 20; // Only margin space needed since header is omitted on page 2+
  };

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
      drawSectionFallback(fallbackTitle, fallbackSubtitle, fallbackColour);
    }
  };

  // ── Original section header fallback ───────────────────────────────────────
  const drawSectionFallback = (title: string, subtitle: string | undefined, colour: RGB) => {
>>>>>>> a2cb41a2ad2dd784a34981adac4663faebb6028c
    ensureSpace(16);
    const H = 10;
    doc.setFillColor(...C.white);
    doc.setDrawColor(...colour);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, y, PW - 28, H, 2.5, 2.5, 'FD');
    doc.setFillColor(...colour);
    doc.roundedRect(14, y, 4, H, 2.5, 0, 'F');
    doc.rect(16.5, y, 1.5, H, 'F');
<<<<<<< HEAD
    doc.setFont(SF, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...colour);
    doc.text(title, 22, y + 6.7);
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.textMuted);
      doc.text(subtitle, PW - 16, y + 6.7, { align: 'right' });
=======
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...colour);
    doc.text(title, 22, y + 6.8);
    if (subtitle) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.textMuted);
      doc.text(subtitle, PW - 16, y + 6.8, { align: 'right' });
>>>>>>> a2cb41a2ad2dd784a34981adac4663faebb6028c
    }
    doc.setTextColor(...C.textDark);
    y += H + 7;
  };

  // Row of metric cards with top colour strip + shadow
  const drawMetricRow = (
    items: Array<{ title: string; value: string; sub: string; accent: RGB }>,
  ) => {
    ensureSpace(22);
<<<<<<< HEAD
    const n = items.length, gap = 3;
    const cardW = (PW - 28 - gap * (n - 1)) / n;
    const cardH = 18;
=======
    const n = items.length, gap = 3.5;
    const cardW = (PW - 28 - gap * (n - 1)) / n, cardH = 22;
>>>>>>> a2cb41a2ad2dd784a34981adac4663faebb6028c
    items.forEach((item, i) => {
      const cx = 14 + i * (cardW + gap);
      doc.setFillColor(0, 0, 0);
      doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
      doc.roundedRect(cx + 0.6, y + 0.6, cardW, cardH, 3, 3, 'F');
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
<<<<<<< HEAD
      doc.setFillColor(...C.white);
      doc.setDrawColor(...C.cardBdr);
      doc.setLineWidth(0.3);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'FD');
      doc.setFillColor(...item.accent);
      doc.roundedRect(cx, y, cardW, 2.5, 2, 0, 'F');
      doc.rect(cx, y + 1.2, cardW, 1.3, 'F');
      doc.setFont(SF, 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...C.textMuted);
      doc.text(item.title.toUpperCase(), cx + cardW / 2, y + 6.5, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...item.accent);
      doc.text(item.value, cx + cardW / 2, y + 12, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.textMuted);
      doc.text(item.sub, cx + cardW / 2, y + 16, { align: 'center' });
    });
    y += cardH + 5;
  };

  // Auto-table wrapper with consistent defaults
  const renderTable = (config: Record<string, any>, hdrColor: RGB, gap = 6) => {
    const sy = y;
    autoTable(doc, {
      ...config,
      startY: y,
      margin: { left: 14, right: 14, ...(config.margin || {}) },
      theme: 'striped',
      styles: {
        fontSize: 8,
        cellPadding: 2.8,
        font: SF,
        textColor: [...C.textDark],
        overflow: 'linebreak' as const,
        lineWidth: 0,
        ...(config.styles || {}),
      },
      headStyles: {
        fillColor: [...hdrColor],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        font: SF,
        fontSize: 8.2,
        cellPadding: 3.2,
        ...(config.headStyles || {}),
      },
      alternateRowStyles: { fillColor: [...C.rowAlt] },
      tableLineColor: [...C.cardBdr],
      tableLineWidth: 0.3,
    });
    y = ((doc as any).lastAutoTable?.finalY ?? sy) + gap;
  };

  // ── Header Banner ────────────────────────────────────────────────────────
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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(t(si, 'ශිෂ්‍ය නැරඹීමේ විස්තර වාර්තාව', 'STUDENT WATCH DETAIL REPORT'), 16, 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(studentName, 16, 25);

  doc.setFont(SF, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(147, 197, 253);
  const headerSub = [cls.name, month.name, recording.title].filter(Boolean).join('  ·  ');
  doc.text(headerSub || t(si, 'නැරඹීමේ ක්‍රියාකාරකම', 'Watch Activity'), 16, 33);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${t(si, 'සකස් කළ දිනය', 'Generated')}: ${fmtDateTime(new Date().toISOString())}`,
    PW - 16, 11, { align: 'right' },
  );

  y = 60;

  // ── Student Info Card ────────────────────────────────────────────────────
  const CARD_H = 46;
=======
      doc.setFillColor(...C.white); doc.setDrawColor(...C.cardBdr); doc.setLineWidth(0.3);
      doc.roundedRect(cx, y, cardW, cardH, 3, 3, 'FD');
      // Colour top strip
      doc.setFillColor(...item.accent);
      doc.roundedRect(cx, y, cardW, 3, 3, 0, 'F');
      doc.rect(cx, y + 1.5, cardW, 1.5, 'F');
      
      // Value
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...item.accent);
      doc.text(item.value, cx + cardW / 2, y + 12, { align: 'center' });
      // Label (bottom)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...C.textMuted);
      doc.text(item.title.toUpperCase(), cx + cardW / 2, y + 18.5, { align: 'center' });
    });
    y += cardH + 7;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // COMPACT STUDENT CARD 
  // ─────────────────────────────────────────────────────────────────────────

  const CARD_H = 26;
  const CARD_X = 14;
  const CARD_W = PW - 28;

  // Drop-shadow
>>>>>>> a2cb41a2ad2dd784a34981adac4663faebb6028c
  doc.setFillColor(0, 0, 0);
  doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
  doc.roundedRect(CARD_X + 0.8, y + 0.8, CARD_W, CARD_H, 3, 3, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));
<<<<<<< HEAD
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.cardBdr);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, y, PW - 28, CARD_H, 3, 3, 'FD');
  doc.setFillColor(...C.hdrBlue);
  doc.roundedRect(14, y, 4, CARD_H, 2.5, 0, 'F');
  doc.rect(17, y, 1, CARD_H, 'F');
=======

  // Card background
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.cardBdr);
  doc.setLineWidth(0.3);
  doc.roundedRect(CARD_X, y, CARD_W, CARD_H, 3, 3, 'FD');

  // Left accent strip
  doc.setFillColor(...C.hdrBlue);
  doc.roundedRect(CARD_X, y, 4, CARD_H, 3, 0, 'F');
  doc.rect(CARD_X + 2, y, 2, CARD_H, 'F'); 

  // Avatar
  const avR = 8;
  const avCx = CARD_X + 16;
  const avCy = y + CARD_H / 2;
>>>>>>> a2cb41a2ad2dd784a34981adac4663faebb6028c

  if (avatarImage) {
<<<<<<< HEAD
    doc.addImage(avatarImage.dataUrl, avatarImage.format, avX, avY, avR * 2, avR * 2);
    doc.setDrawColor(...C.cardBdr);
    doc.setLineWidth(1.2);
    doc.circle(avX + avR, avY + avR, avR, 'S');
  } else {
    doc.setFillColor(...C.hdrBlue);
    doc.circle(avX + avR, avY + avR, avR, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...C.white);
    doc.text(initialsFromName(studentName), avX + avR, avY + avR + 2.5, { align: 'center' });
  }

  // Student details — left column
  const tx = avX + avR * 2 + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.textDark);
  doc.text(studentName, tx, y + 15);
  doc.setFont(SF, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.textMuted);
  doc.text(`${t(si, 'ආයතන හැඳුනුම්පත', 'Institute ID')}: ${profile.instituteId || '—'}`, tx, y + 21);
  doc.text(`${t(si, 'දුරකථන', 'Phone')}: ${profile.phone || '—'}`, tx, y + 27);
  doc.text(`${t(si, 'විද්‍යුත් තැපෑල', 'Email')}: ${user.email || '—'}`, tx, y + 33);
  doc.text(`${t(si, 'ලියාපදිංචි', 'Enrolled')}: ${student.enrolled ? t(si, 'ඔව්', 'Yes') : t(si, 'නැත', 'No')}`, tx, y + 39);

  // Status badges — right column
  const rx = PW - 65;
  const attStatus = student.attendanceStatus || t(si, 'නොනැරඹූ', 'Not Watched');
  const payStatus  = student.paymentStatus   || t(si, 'නොගෙවූ',  'Unpaid');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.textMuted);
  doc.text(t(si, 'පැමිණීමේ තත්ත්වය', 'Attendance Status'), rx, y + 15);
  doc.setFont(SF, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.textDark);
  doc.text(attStatus, rx, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.textMuted);
  doc.text(t(si, 'ගෙවීම් තත්ත්වය', 'Payment Status'), rx, y + 28);
  doc.setFont(SF, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.textDark);
  doc.text(payStatus, rx, y + 34);

  y += CARD_H + 6;

  // ── Metric Row ───────────────────────────────────────────────────────────
  drawMetricRow([
    {
      title:  t(si, 'නැරඹීමේ සැසි',             'Watch Sessions'),
      value:  String(student.sessionCount || 0),
      sub:    t(si, 'මුළු සැසි ගණන',             'Total sessions captured'),
      accent: C.info,
    },
    {
      title:  t(si, 'මුළු නැරඹීම',               'Total Watched'),
      value:  fmtDuration(student.totalWatchedSec || 0),
      sub:    t(si, 'සියලු සැසි හරහා',           'Across all sessions'),
      accent: C.success,
    },
    {
      title:  t(si, 'ක්‍රියාකාරකම් සිදුවීම්',   'Activity Events'),
      value:  String(allActivityEvents.length),
      sub:    t(si, 'පාඩම් + පැමිණීම් සිදුවීම්', 'Playback + attendance events'),
      accent: C.warning,
    },
  ]);

  // ── Report Overview ──────────────────────────────────────────────────────
  drawSection(
    t(si, 'වාර්තා දළ විශ්ලේෂණය',              'Report Overview'),
    t(si, 'පන්ති, පාඩම් සහ කාල සීමා විස්තර', 'Core class, recording and timeline metadata'),
  );
  renderTable(
    {
      head: [[t(si, 'තොරතුර', 'Field'), t(si, 'විස්තරය', 'Value')]],
      body: [
        [t(si, 'පන්තිය',             'Class'),          cls.name        || '—'],
        [t(si, 'මාසය',               'Month'),          month.name      || '—'],
        [t(si, 'පාඩමේ නම',           'Recording'),      recording.title || '—'],
        [t(si, 'පාඩමේ කාලය',         'Duration'),       recording.duration ? fmtSec(recording.duration) : '—'],
        [t(si, 'සැසි ගණන',           'Sessions'),       String(student.sessionCount || 0)],
        [t(si, 'මුළු නැරඹීම',        'Total Watched'),  fmtDuration(student.totalWatchedSec || 0)],
        [t(si, 'පැමිණීමේ නැරඹීම',   'Att. Watched'),   fmtDuration(student.attendanceWatchedSec || 0)],
        [t(si, 'අවසාන නැරඹීම',       'Last Watched'),   fmtDateTime(student.lastWatchedAt)],
        [t(si, 'සජීවී සම්බන්ධය',     'Live Joined At'), fmtDateTime(student.liveJoinedAt)],
      ],
      columnStyles: {
        0: { cellWidth: 44, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
      },
    },
    C.tblHead,
    5,
  );

  // Summary row
  renderTable(
    {
      head: [[
        t(si, 'සැසි',               'Session Count'),
        t(si, 'මුළු නැරඹීම',       'Total Watch'),
        t(si, 'පැමිණීමේ නැරඹීම',  'Attendance Watch'),
        t(si, 'පැමිණීමේ තත්ත්වය', 'Attendance Status'),
        t(si, 'ගෙවීම් තත්ත්වය',    'Payment Status'),
        t(si, 'සිදුවීම්',           'Events'),
      ]],
      body: [[
        String(student.sessionCount || 0),
        fmtDuration(student.totalWatchedSec || 0),
        fmtDuration(student.attendanceWatchedSec || 0),
        student.attendanceStatus || t(si, 'නොනැරඹූ', 'NOT VIEWED'),
        student.paymentStatus    || t(si, 'නොගෙවූ',  'UNPAID'),
        String(allActivityEvents.length),
      ]],
      styles: { halign: 'center' },
    },
    C.sumHead,
    6,
  );

  // ── Watch Sessions ───────────────────────────────────────────────────────
  drawSection(
    `${t(si, 'නැරඹීමේ සැසි', 'Watch Sessions')} (${sessions.length})`,
    t(si, 'සැසි මට්ටමේ නැරඹීමේ හැසිරීම සහ ක්‍රියාකාරකම් ගණන',
         'Session-level watch behavior with event counts and active ratio'),
  );
  renderTable(
    {
      head: [[
        '#',
        t(si, 'තත්ත්වය',        'Status'),
        t(si, 'ආරම්භය',        'Started'),
        t(si, 'අවසානය',        'Ended'),
        t(si, 'නැරඹීම',        'Watched'),
        t(si, 'සැබෑ කාලය',    'Real Time'),
        t(si, 'සක්‍රිය',      'Active'),
        t(si, 'සිදුවීම්',      'Events'),
        t(si, 'වීඩියෝ පරාසය', 'Video Range'),
      ]],
      body: sessions.length > 0
        ? sessions.map((session: any, i: number) => [
            String(i + 1),
            sessionStatusLabel(session.status, si),
            fmtDateTime(session.startedAt),
            fmtDateTime(session.endedAt),
            fmtDuration(session.totalWatchedSec || 0),
            fmtDuration(calcRealDuration(session)),
            `${calcActivePercent(session)}%`,
            String(countSessionEvents(session)),
            `${fmtSec(session.videoStartPos || 0)} → ${fmtSec(session.videoEndPos || 0)}`,
          ])
        : [['—', '—', '—', '—', '—', '—', '—', '—', '—']],
      columnStyles: {
        0: { cellWidth: 10,  halign: 'center' },
        1: { cellWidth: 18,  halign: 'center' },
        2: { cellWidth: 28 },
        3: { cellWidth: 28 },
        4: { cellWidth: 16,  halign: 'center' },
        5: { cellWidth: 16,  halign: 'center' },
        6: { cellWidth: 14,  halign: 'center' },
        7: { cellWidth: 12,  halign: 'center' },
        8: { cellWidth: 'auto' },
      },
    },
    C.tblHead,
    6,
  );

  // ── Activity Timeline ────────────────────────────────────────────────────
  drawSection(
    `${t(si, 'ක්‍රියාකාරකම් කාලරේඛාව', 'Activity Timeline')} (${allActivityEvents.length})`,
    t(si, 'කාලානුක්‍රමික පිළිවෙලින් නැරඹීමේ ක්‍රියාකාරකම් සහ පැමිණීමේ සිදුවීම්',
         'Playback actions, seeks and attendance events in chronological order'),
  );
  renderTable(
    {
      head: [[
        t(si, 'කවදා',           'When'),
        t(si, 'ක්‍රියාකාරකම', 'Activity'),
        t(si, 'මූලාශ්‍රය',     'Source'),
        t(si, 'වීඩියෝ ස්ථානය', 'Video Position'),
        t(si, 'නැරඹූ කාලය',   'Watched Time'),
        t(si, 'විස්තරය',       'Details'),
      ]],
      body: allActivityEvents.length > 0
        ? allActivityEvents.map((evt: any) => {
            const raw       = String(evt.type || evt.event || 'UNKNOWN');
            const when      = fmtDateTime(evt.at || evt.wallTime || evt.timestamp);
            const source    = evt._source === 'session'
              ? `${t(si, 'සැසිය', 'Session')}${evt._sessionNum ? ` #${evt._sessionNum}` : ''}`
              : t(si, 'පැමිණීම', 'Attendance');
            const videoTime = evt.videoTime ?? evt.videoPosition;
            const seekFrom  = evt.seekFrom  ?? evt.fromVideoTime;
            const seekTo    = evt.seekTo    ?? evt.toVideoTime;
            const details   =
              seekFrom != null && seekTo != null
                ? `${fmtSec(Number(seekFrom))} -> ${fmtSec(Number(seekTo))}`
                : (evt.note || evt.reason || '—');

            return [
              when,
              activityLabel(raw, si),
              source,
              videoTime != null ? fmtSec(Number(videoTime)) : '—',
              evt.watchedSec != null ? fmtDuration(Number(evt.watchedSec)) : '—',
              String(details),
            ];
          })
        : [['—', '—', '—', '—', '—', '—']],
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 36 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 16, halign: 'center' },
        5: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14, bottom: 10 },
    },
    C.tblHead,
    6,
  );

  // ── Footer on every page ─────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    if (p > 1) {
      doc.setFillColor(...C.pageBg);
      doc.rect(0, 0, PW, PH, 'F');
    }
=======
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
    doc.setFillColor(...C.hdrBlue);
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
  const instId = profile.instituteId || '—';
  doc.text(`ID: ${instId}`, nameX, y + 17);

  // Phone
  const phoneX = CARD_X + CARD_W - 12;
  const phoneStr = profile.phone || '—';
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
  // REPORT TABLES & STATS
  // ─────────────────────────────────────────────────────────────────────────

  drawMetricRow([
    { title: 'Watch Sessions', value: String(student.sessionCount || 0), sub: '', accent: C.info },
    { title: 'Total Watched', value: fmtDuration(student.totalWatchedSec || 0), sub: '', accent: C.success },
    { title: 'Activity Events', value: String(allActivityEvents.length), sub: '', accent: C.warning }
  ]);

  const tableStyles = {
    fontSize: 8.3,
    cellPadding: 2.5,
    lineColor: [...C.cardBdr] as number[],
    lineWidth: 0.15,
    textColor: [...C.textDark] as number[],
    overflow: 'linebreak' as const,
  };

  drawSectionBanner(overviewBannerImage, 'Report Overview', 'Core class, recording and timeline metadata', C.hdrBlue);
  
  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: [
      ['Class',          cls.name        || '—'],
      ['Month',          month.name      || '—'],
      ['Recording',      recording.title || '—'],
      ['Duration',       recording.duration ? fmtSec(recording.duration) : '—'],
      ['Sessions',       String(student.sessionCount || 0)],
      ['Total Watched',  fmtDuration(student.totalWatchedSec || 0)],
      ['Att. Watched',   fmtDuration(student.attendanceWatchedSec || 0)],
      ['Last Watched',   fmtDateTime(student.lastWatchedAt)],
      ['Live Joined At', fmtDateTime(student.liveJoinedAt)],
    ],
    styles: { ...tableStyles, fontSize: 8.5 },
    columnStyles: { 0: { cellWidth: 44, fontStyle: 'bold' }, 1: { cellWidth: 'auto', font: SF } },
    headStyles: { fillColor: [...C.tableHead] as number[], textColor: [...C.white] as number[], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [...C.rowAlt] as number[] },
    margin: { left: 14, right: 14 },
    theme: 'grid',
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 5;

  autoTable(doc, {
    startY: y,
    head: [['Session Count', 'Total Watch', 'Attendance Watch', 'Attendance Status', 'Payment Status', 'Events']],
    body: [[
      String(student.sessionCount || 0),
      fmtDuration(student.totalWatchedSec || 0),
      fmtDuration(student.attendanceWatchedSec || 0),
      student.attendanceStatus || 'NOT VIEWED',
      student.paymentStatus || 'UNPAID',
      String(allActivityEvents.length),
    ]],
    styles: { ...tableStyles, fontSize: 8.5, halign: 'center' },
    headStyles: { fillColor: [...C.summaryHead] as number[], textColor: [...C.white] as number[], fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
    theme: 'grid',
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 10;

  drawSectionBanner(sessionBannerImage, `Watch Sessions (${sessions.length})`, 'Session-level watch behavior', C.hdrBlue, sessions.length);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Status', 'Started', 'Ended', 'Watched', 'Real Time', 'Active', 'Events', 'Video Range']],
    body: sessions.length > 0
      ? sessions.map((session: any, i: number) => [
          String(i + 1),
          sessionStatusLabel(session.status),
          fmtDateTime(session.startedAt),
          fmtDateTime(session.endedAt),
          fmtDuration(session.totalWatchedSec || 0),
          fmtDuration(calcRealDuration(session)),
          `${calcActivePercent(session)}%`,
          String(countSessionEvents(session)),
          `${fmtSec(session.videoStartPos || 0)} → ${fmtSec(session.videoEndPos || 0)}`,
        ])
      : [['—', '—', '—', '—', '—', '—', '—', '—', '—']],
    styles: { fontSize: 7.8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 12, halign: 'center' },
      8: { cellWidth: 30 },
    },
    headStyles: { fillColor: [...C.tableHead] as number[], textColor: [...C.white] as number[], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [...C.rowAlt] as number[] },
    margin: { left: 14, right: 14 },
    theme: 'grid',
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 10;

  drawSectionBanner(timelineBannerImage, `Activity Timeline (${allActivityEvents.length})`, 'Playback actions and attendance', C.hdrBlue, allActivityEvents.length);

  autoTable(doc, {
    startY: y,
    head: [['When', 'Activity', 'Source', 'Video Pos', 'Watched', 'Details']],
    body: allActivityEvents.length > 0
      ? allActivityEvents.map((evt: any) => {
          const raw = String(evt.type || evt.event || 'UNKNOWN');
          const when = fmtDateTime(evt.at || evt.wallTime || evt.timestamp);
          const source = evt._source === 'session'
            ? `Session${evt._sessionNum ? ` #${evt._sessionNum}` : ''}`
            : 'Attendance';
          const videoTime = evt.videoTime ?? evt.videoPosition;
          const seekFrom = evt.seekFrom ?? evt.fromVideoTime;
          const seekTo = evt.seekTo ?? evt.toVideoTime;
          const details = seekFrom != null && seekTo != null
            ? `${fmtSec(Number(seekFrom))} -> ${fmtSec(Number(seekTo))}`
            : (evt.note || evt.reason || '-');

          return [
            when,
            activityLabel(raw),
            source,
            videoTime != null ? fmtSec(Number(videoTime)) : '-',
            evt.watchedSec != null ? fmtDuration(Number(evt.watchedSec)) : '-',
            String(details),
          ];
        })
      : [['—', '—', '—', '—', '—', '—']],
    styles: { fontSize: 7.5, cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 36 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 30 },
    },
    headStyles: { fillColor: [...C.tableHead] as number[], textColor: [...C.white] as number[], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [...C.rowAlt] as number[] },
    margin: { left: 14, right: 14, bottom: 10 },
    theme: 'grid',
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER — every page
  // ─────────────────────────────────────────────────────────────────────────

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    
    // Bottom border strip
>>>>>>> a2cb41a2ad2dd784a34981adac4663faebb6028c
    doc.setFillColor(...C.hdrBlue);
    doc.rect(0, PH - 11, PW, 0.9, 'F');
    doc.setFillColor(244, 246, 250);
    doc.rect(0, PH - 10.1, PW, 10.1, 'F');
<<<<<<< HEAD
    doc.setFont(SF, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.textMuted);
    doc.text(`${t(si, 'සිසුවා', 'Student')}: ${studentName}`, 16, PH - 4);
    doc.setFont('helvetica', 'normal');
    doc.text('Thilina Dhananjaya LMS', PW / 2, PH - 4, { align: 'center' });
    doc.text(`${t(si, 'පිටුව', 'Page')} ${p} / ${pageCount}`, PW - 16, PH - 4, { align: 'right' });
=======
    
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.textMuted);
    doc.text(studentName, 16, PH - 4);
    
    doc.text('Student Watch Detail Report', PW / 2, PH - 4, { align: 'center' });
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.hdrBlue);
    doc.text(`${p} / ${pageCount}`, PW - 14, PH - 4, { align: 'right' });
>>>>>>> a2cb41a2ad2dd784a34981adac4663faebb6028c
  }

  const fileName = cleanFileName(
    `Student-Watch-Detail-${studentName}-${recording.title || 'Recording'}.pdf`,
  );
  doc.save(fileName);
}