import api from './api';

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
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    '  ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function calcRealDuration(session: any): number {
  if (!session?.endedAt || !session?.startedAt) return 0;
  return Math.max(0, Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000));
}

function calcActivePercent(session: any): number {
  const realSec = calcRealDuration(session);
  if (!realSec) return 0;
  return Math.min(100, Math.round(((session?.totalWatchedSec || 0) / realSec) * 100));
}

function cleanFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
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

/** Translates raw session status to Sinhala / English hybrid */
function sessionStatusLabel(raw: string | undefined, sinhala: boolean): string {
  const v = (raw || '').toUpperCase();
  if (!sinhala) {
    if (v === 'WATCHING') return 'Watching';
    if (v === 'ENDED')    return 'Ended';
    if (v === 'PAUSED')   return 'Paused';
    if (v === 'JOINED')   return 'Joined';
    return raw || '—';
  }
  if (v === 'WATCHING') return 'නරඹමින්';
  if (v === 'ENDED')    return 'අවසන්';
  if (v === 'PAUSED')   return 'විරාම';
  if (v === 'JOINED')   return 'සම්බන්ධ වූ';
  return raw || '—';
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

async function loadAvatarImage(rawUrl?: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  const resolved = resolveAssetUrl(rawUrl);
  if (!resolved) return null;
  try {
    if (/^data:image\//i.test(resolved)) return { dataUrl: resolved, format: resolved.toLowerCase().startsWith('data:image/png') ? 'PNG' : 'JPEG' };
    const response = await fetch(resolved, { credentials: 'include' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return { dataUrl: await blobToDataUrl(blob), format: blob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG' };
  } catch { return null; }
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

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function exportStudentWatchDetailPdf(data: any): Promise<void> {
  if (!data) return;

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);

  const student  = data.student    || {};
  const user     = student.user    || {};
  const profile  = user.profile    || {};
  const recording = data.recording || {};
  const cls      = data.class      || {};
  const month    = data.month      || {};

  const sessions: any[]    = Array.isArray(student.sessions)           ? [...student.sessions].reverse() : [];
  const attDetails: any[]  = Array.isArray(student.attendanceDetails)  ? student.attendanceDetails        : [];
  const studentName = profile.fullName || user.email || 'Student';

  // Build unified, time-sorted activity timeline — filter noisy heartbeats
  const allActivityEvents: any[] = [
    ...attDetails.map((e: any) => ({ ...e, _source: 'attendance' })),
    ...sessions.flatMap((session: any, idx: number) =>
      (Array.isArray(session.events) ? session.events : [])
        .filter((e: any) => {
          const t = String(e?.type || e?.event || '').toUpperCase();
          return !t.includes('HB') && !t.includes('HEARTBEAT') && t !== 'IDLE' && t !== 'FOCUS';
        })
        .map((e: any) => ({ ...e, _source: 'session', _sessionNum: idx + 1 })),
    ),
  ].sort((a, b) => {
    const ta = new Date(a.at || a.wallTime || a.timestamp || 0).getTime();
    const tb = new Date(b.at || b.wallTime || b.timestamp || 0).getTime();
    return ta - tb;
  });

  const avatarImage = await loadAvatarImage(profile.avatarUrl);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();

  const sinhalaLoaded = await registerSinhalaFont(doc);
  const SF = sinhalaLoaded ? SINHALA_FONT_NAME : 'helvetica';

  type RGB = readonly [number, number, number];

  const C = {
    pageBg:    [247, 248, 250] as RGB,
    white:     [255, 255, 255] as RGB,
    cardBdr:   [209, 213, 219] as RGB,
    rowAlt:    [249, 250, 252] as RGB,
    hdrBg:     [17, 24, 39]   as RGB,
    hdrBlue:   [37, 99, 235]  as RGB,
    secOver:   [15, 118, 110] as RGB,    // teal — overview
    secSes:    [79, 70, 229]  as RGB,    // indigo — sessions
    secAct:    [180, 83, 9]   as RGB,    // amber — activity
    tblOver:   [15, 118, 110] as RGB,
    tblSes:    [79, 70, 229]  as RGB,
    tblAct:    [180, 83, 9]   as RGB,
    textDark:  [15, 23, 42]   as RGB,
    textMuted: [107, 114, 128] as RGB,
    info:      [37, 99, 235]  as RGB,
    success:   [22, 163, 74]  as RGB,
    warning:   [217, 119, 6]  as RGB,
    slate:     [71, 85, 105]  as RGB,
  };

  let y = 0;

  const initBg = () => { doc.setFillColor(...C.pageBg); doc.rect(0, 0, PW, PH, 'F'); };
  initBg();

  const ensureSpace = (needed: number) => {
    if (y + needed <= PH - 16) return;
    doc.addPage(); initBg(); y = 20;
  };

  // ── Section header (coloured bar + left accent) ───────────────────────────
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
    doc.setFont(SF, 'bold'); doc.setFontSize(9.5); doc.setTextColor(...colour);
    doc.text(title, 22, y + 6.7);
    if (subtitle) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.textMuted);
      doc.text(subtitle, PW - 16, y + 6.7, { align: 'right' });
    }
    doc.setTextColor(...C.textDark);
    y += H + 5;
  };

  // ── Metric card row ───────────────────────────────────────────────────────
  const drawMetricRow = (items: Array<{ title: string; value: string; sub: string; accent: RGB }>) => {
    ensureSpace(22);
    const n = items.length, gap = 3;
    const cardW = (PW - 28 - gap * (n - 1)) / n, cardH = 18;
    items.forEach((item, i) => {
      const cx = 14 + i * (cardW + gap);
      doc.setFillColor(0, 0, 0);
      doc.setGState(new (doc as any).GState({ opacity: 0.03 }));
      doc.roundedRect(cx + 0.5, y + 0.5, cardW, cardH, 2, 2, 'F');
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
      doc.setFillColor(...C.white); doc.setDrawColor(...C.cardBdr); doc.setLineWidth(0.3);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'FD');
      // Colour top strip
      doc.setFillColor(...item.accent);
      doc.roundedRect(cx, y, cardW, 2.5, 2, 0, 'F');
      doc.rect(cx, y + 1.2, cardW, 1.3, 'F');
      // Label (top)
      doc.setFont(SF, 'bold'); doc.setFontSize(7); doc.setTextColor(...C.textMuted);
      doc.text(item.title.toUpperCase(), cx + cardW / 2, y + 6.5, { align: 'center' });
      // Value
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...item.accent);
      doc.text(item.value, cx + cardW / 2, y + 12, { align: 'center' });
      // Sub
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.textMuted);
      doc.text(item.sub, cx + cardW / 2, y + 16, { align: 'center' });
    });
    y += cardH + 5;
  };

  const renderTable = (config: Record<string, any>, hdrColor: RGB, gap = 6) => {
    const sy = y;
    autoTable(doc, {
      ...config, startY: y, margin: { left: 14, right: 14 }, theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2.8, textColor: [...C.textDark], overflow: 'linebreak', lineWidth: 0 },
      headStyles: { fillColor: [...hdrColor], textColor: [255, 255, 255], fontStyle: 'bold', font: SF, fontSize: 8.2, cellPadding: 3.2 },
      alternateRowStyles: { fillColor: [...C.rowAlt] },
      tableLineColor: [...C.cardBdr], tableLineWidth: 0.3,
    });
    y = ((doc as any).lastAutoTable?.finalY ?? sy) + gap;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HEADER BANNER
  // ─────────────────────────────────────────────────────────────────────────

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
  doc.text('STUDENT WATCH DETAIL REPORT', 16, 11);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(255, 255, 255);
  doc.text(studentName, 16, 25);

  doc.setFont(SF, 'normal'); doc.setFontSize(9); doc.setTextColor(147, 197, 253);
  const headerSub = [cls.name, month.name, recording.title].filter(Boolean).join('  ·  ');
  doc.text(headerSub || 'Watch Activity', 16, 33);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, PW - 16, 11, { align: 'right' });

  y = 60;

  // ─────────────────────────────────────────────────────────────────────────
  // STUDENT CARD
  // ─────────────────────────────────────────────────────────────────────────

  const CARD_H = 46;
  doc.setFillColor(0, 0, 0);
  doc.setGState(new (doc as any).GState({ opacity: 0.04 }));
  doc.roundedRect(14.5, y + 1, PW - 29, CARD_H, 3, 3, 'F');
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  doc.setFillColor(...C.white); doc.setDrawColor(...C.cardBdr); doc.setLineWidth(0.5);
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
  doc.text(`Institute ID: ${profile.instituteId || '—'}`, tx, y + 21);
  doc.text(`Phone: ${profile.phone || '—'}`, tx, y + 27);
  doc.text(`Email: ${user.email || '—'}`, tx, y + 33);

  const rx = PW - 65;
  const attStatus = student.attendanceStatus || (sinhalaLoaded ? 'නොනැරඹූ' : 'Not Watched');
  const payStatus  = student.paymentStatus   || (sinhalaLoaded ? 'නොගෙවූ'  : 'Unpaid');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.textMuted);
  doc.text('Attendance Status', rx, y + 15);
  doc.setFont(SF, 'bold'); doc.setFontSize(9); doc.setTextColor(...C.textDark);
  doc.text(attStatus, rx, y + 21);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.textMuted);
  doc.text('Payment Status', rx, y + 28);
  doc.setFont(SF, 'bold'); doc.setFontSize(9); doc.setTextColor(...C.textDark);
  doc.text(payStatus, rx, y + 34);

  y += CARD_H + 10;

  // ─────────────────────────────────────────────────────────────────────────
  // METRIC ROW
  // ─────────────────────────────────────────────────────────────────────────

  drawMetricRow([
    { title: sinhalaLoaded ? 'නැරඹීමේ සැසි' : 'Watch Sessions', value: String(student.sessionCount || 0), sub: 'Total sessions', accent: C.info },
    { title: sinhalaLoaded ? 'මුළු නැරඹීම'  : 'Total Watched',   value: fmtDuration(student.totalWatchedSec || 0), sub: 'Across all sessions', accent: C.success },
    { title: sinhalaLoaded ? 'ක්‍රියාකාරකම්' : 'Activity Events', value: String(allActivityEvents.length), sub: 'Filtered events', accent: C.warning },
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // REPORT OVERVIEW
  // ─────────────────────────────────────────────────────────────────────────

  drawSection(sinhalaLoaded ? 'වාර්තා දළ විශ්ලේෂණය  /  Report Overview' : 'Report Overview', undefined, C.secOver);

  renderTable({
    head: [[sinhalaLoaded ? 'තොරතුර' : 'Field', sinhalaLoaded ? 'විස්තරය' : 'Value']],
    body: [
      [sinhalaLoaded ? 'පන්තිය'           : 'Class',          cls.name        || '—'],
      [sinhalaLoaded ? 'මාසය'             : 'Month',          month.name      || '—'],
      [sinhalaLoaded ? 'පාඩමේ නම'         : 'Recording',      recording.title || '—'],
      [sinhalaLoaded ? 'පාඩමේ කාලය'       : 'Duration',       recording.duration ? fmtSec(recording.duration) : '—'],
      [sinhalaLoaded ? 'සැසි ගණන'         : 'Sessions',       String(student.sessionCount || 0)],
      [sinhalaLoaded ? 'මුළු නැරඹීම'      : 'Total Watched',  fmtDuration(student.totalWatchedSec || 0)],
      [sinhalaLoaded ? 'පැමිණීමේ නැරඹීම' : 'Att. Watched',   fmtDuration(student.attendanceWatchedSec || 0)],
      [sinhalaLoaded ? 'අවසාන නැරඹීම'    : 'Last Watched',   fmtDateTime(student.lastWatchedAt)],
      [sinhalaLoaded ? 'සජීවී සම්බන්ධය'  : 'Live Joined At', fmtDateTime(student.liveJoinedAt)],
    ],
    styles: { fontSize: 8.8, cellPadding: 3.2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: (PW - 28) * 0.38, fontStyle: 'bold', font: SF },
      1: { cellWidth: (PW - 28) * 0.62 },
    },
  }, C.tblOver, 10);

  // ─────────────────────────────────────────────────────────────────────────
  // WATCH SESSIONS TABLE
  // ─────────────────────────────────────────────────────────────────────────

  const countSessionEvents = (session: any): number =>
    Array.isArray(session?.events)
      ? session.events.filter((e: any) => {
          const t = String(e?.type || e?.event || '').toUpperCase();
          return !t.includes('HB') && !t.includes('HEARTBEAT') && t !== 'IDLE' && t !== 'FOCUS';
        }).length
      : 0;

  drawSection(
    sinhalaLoaded ? `නැරඹීමේ සැසි  /  Watch Sessions (${sessions.length})` : `Watch Sessions (${sessions.length})`,
    sinhalaLoaded ? 'සැසි මට්ටමේ ක්‍රියාකාරකම් විස්තර' : 'Per-session breakdown',
    C.secSes,
  );

  renderTable({
    head: [[
      '#',
      sinhalaLoaded ? 'තත්ත්වය'     : 'Status',
      sinhalaLoaded ? 'ආරම්භය'      : 'Started',
      sinhalaLoaded ? 'අවසානය'      : 'Ended',
      sinhalaLoaded ? 'නැරඹීම'      : 'Watched',
      sinhalaLoaded ? 'සැබෑ කාලය'   : 'Duration',
      sinhalaLoaded ? 'සක්‍රිය %'   : 'Active%',
      sinhalaLoaded ? 'සිදුවීම්'    : 'Events',
      sinhalaLoaded ? 'වීඩියෝ පරාසය': 'Video Range',
    ]],
    body: sessions.length > 0
      ? sessions.map((session: any, i: number) => [
          String(i + 1),
          sessionStatusLabel(session.status, sinhalaLoaded),
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
      1: { cellWidth: 18, halign: 'center', font: SF },
      2: { cellWidth: 28, font: SF },
      3: { cellWidth: 28, font: SF },
      4: { cellWidth: 16, halign: 'center', font: SF },
      5: { cellWidth: 16, halign: 'center', font: SF },
      6: { cellWidth: 14, halign: 'center', font: SF },
      7: { cellWidth: 12, halign: 'center', font: SF },
      8: { cellWidth: 30, font: SF },
    },
  }, C.tblSes, 10);

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIVITY TIMELINE
  // ─────────────────────────────────────────────────────────────────────────

  const maxEvents = 60;
  const displayEvents = allActivityEvents.slice(0, maxEvents);

  drawSection(
    sinhalaLoaded ? `ක්‍රියාකාරකම් කාලරේඛාව  /  Activity Timeline (${allActivityEvents.length})` : `Activity Timeline (${allActivityEvents.length})`,
    allActivityEvents.length > maxEvents ? `Showing first ${maxEvents} of ${allActivityEvents.length}` : undefined,
    C.secAct,
  );

  renderTable({
    head: [[
      sinhalaLoaded ? 'කවදා'        : 'When',
      sinhalaLoaded ? 'ක්‍රියාකාරකම' : 'Activity',
      sinhalaLoaded ? 'මූලාශ්‍රය'   : 'Source',
      sinhalaLoaded ? 'වීඩියෝ ස්ථානය': 'Video Pos',
      sinhalaLoaded ? 'නැරඹූ'       : 'Watched',
      sinhalaLoaded ? 'විස්තරය'     : 'Detail',
    ]],
    body: displayEvents.length > 0
      ? displayEvents.map((evt: any) => {
          const raw    = String(evt.type || evt.event || 'UNKNOWN');
          const when   = fmtDateTime(evt.at || evt.wallTime || evt.timestamp);
          const source = evt._source === 'session' ? `Session${evt._sessionNum ? ` #${evt._sessionNum}` : ''}` : (sinhalaLoaded ? 'පැමිණීම' : 'Attendance');
          const vt     = evt.videoTime ?? evt.videoPosition;
          const sFrom  = evt.seekFrom  ?? evt.fromVideoTime;
          const sTo    = evt.seekTo    ?? evt.toVideoTime;
          const detail = sFrom != null && sTo != null
            ? `${fmtSec(Number(sFrom))} → ${fmtSec(Number(sTo))}`
            : (evt.note || evt.reason || '—');
          return [when, activityLabel(raw), source, vt != null ? fmtSec(Number(vt)) : '—', evt.watchedSec != null ? fmtDuration(Number(evt.watchedSec)) : '—', String(detail)];
        })
      : [['—', '—', '—', '—', '—', '—']],
    styles: { fontSize: 7.5, cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 34, font: SF },
      1: { cellWidth: 36, font: SF },
      2: { cellWidth: 22, halign: 'center', font: SF },
      3: { cellWidth: 18, halign: 'center', font: SF },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 30, font: SF },
    },
  }, C.tblAct, 8);

  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER — every page
  // ─────────────────────────────────────────────────────────────────────────

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    if (p > 1) { doc.setFillColor(...C.pageBg); doc.rect(0, 0, PW, PH, 'F'); }
    doc.setFillColor(...C.hdrBlue);
    doc.rect(0, PH - 11, PW, 0.9, 'F');
    doc.setFillColor(244, 246, 250);
    doc.rect(0, PH - 10.1, PW, 10.1, 'F');
    doc.setFont(SF, 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.textMuted);
    doc.text(studentName, 16, PH - 4);
    doc.setFont('helvetica', 'normal');
    doc.text('Student Watch Detail Report', PW / 2, PH - 4, { align: 'center' });
    doc.text(`Page ${p} / ${pageCount}`, PW - 16, PH - 4, { align: 'right' });
  }

  const fileName = cleanFileName(`Student-Watch-Detail-${studentName}-${recording.title || 'Recording'}.pdf`);
  doc.save(fileName);
}