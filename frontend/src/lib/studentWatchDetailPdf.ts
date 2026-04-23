import api from './api';

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

async function loadAvatarImage(
  rawUrl?: string,
): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  const resolved = resolveAssetUrl(rawUrl);
  if (!resolved) return null;
  try {
    if (/^data:image\//i.test(resolved)) {
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
  } catch {
    return null;
  }
}

// ─── Sinhala Font ─────────────────────────────────────────────────────────────

const SINHALA_FONT_URL =
  'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansSinhala/NotoSansSinhala-Regular.ttf';
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
  } catch {
    return false;
  }
}

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

  const avatarImage = await loadAvatarImage(profile.avatarUrl);

  // ── jsPDF init ───────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW  = doc.internal.pageSize.getWidth();
  const PH  = doc.internal.pageSize.getHeight();

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

  const countSessionEvents = (session: any): number => {
    if (!Array.isArray(session?.events)) return 0;
    return session.events.filter((event: any) => {
      const type = String(event?.type || event?.event || '').toUpperCase();
      return !type.includes('HB') && !type.includes('HEARTBEAT') && type !== 'IDLE' && type !== 'FOCUS';
    }).length;
  };

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
    ensureSpace(16);
    const H = 10;
    doc.setFillColor(...C.white);
    doc.setDrawColor(...colour);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, y, PW - 28, H, 2, 2, 'FD');
    doc.setFillColor(...colour);
    doc.roundedRect(14, y, 4, H, 2, 0, 'F');
    doc.rect(16.5, y, 1.5, H, 'F');
    doc.setFont(SF, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...colour);
    doc.text(title, 22, y + 6.7);
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.textMuted);
      doc.text(subtitle, PW - 16, y + 6.7, { align: 'right' });
    }
    doc.setTextColor(...C.textDark);
    y += H + 5;
  };

  // Row of metric cards with top colour strip + shadow
  const drawMetricRow = (
    items: Array<{ title: string; value: string; sub: string; accent: RGB }>,
  ) => {
    ensureSpace(22);
    const n = items.length, gap = 3;
    const cardW = (PW - 28 - gap * (n - 1)) / n;
    const cardH = 18;
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
    doc.setFillColor(...C.hdrBlue);
    doc.rect(0, PH - 11, PW, 0.9, 'F');
    doc.setFillColor(244, 246, 250);
    doc.rect(0, PH - 10.1, PW, 10.1, 'F');
    doc.setFont(SF, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.textMuted);
    doc.text(`${t(si, 'සිසුවා', 'Student')}: ${studentName}`, 16, PH - 4);
    doc.setFont('helvetica', 'normal');
    doc.text('Thilina Dhananjaya LMS', PW / 2, PH - 4, { align: 'center' });
    doc.text(`${t(si, 'පිටුව', 'Page')} ${p} / ${pageCount}`, PW - 16, PH - 4, { align: 'right' });
  }

  const fileName = cleanFileName(
    `Student-Watch-Detail-${studentName}-${recording.title || 'Recording'}.pdf`,
  );
  doc.save(fileName);
}