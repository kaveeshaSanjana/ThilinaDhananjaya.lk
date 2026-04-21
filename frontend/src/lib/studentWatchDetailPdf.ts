import api from './api';

function fmtSec(sec: number): string {
  if (!sec || sec <= 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
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

function fmtDateTime(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${date} ${time}`;
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

function activityLabel(rawType: string): string {
  const raw = rawType.toUpperCase();
  if (raw === 'PUSH') return 'Marked Present';
  if (raw === 'INCOMPLETE_EXIT') return 'Left Early (Incomplete)';
  if (raw === 'MANUAL') return 'Manually Marked';
  if (raw === 'LIVE_JOIN') return 'Joined Live';
  if (raw === 'START' || raw === 'PLAY' || raw === 'VIDEO_PLAY') return 'Started Watching';
  if (raw === 'RESUME' || raw === 'VIDEO_RESUME') return 'Resumed Video';
  if (raw === 'PAUSE' || raw === 'VIDEO_PAUSE') return 'Paused Video';
  if (raw.includes('SEEK')) return 'Seeked';
  if (raw === 'VIDEO_ENDED' || raw === 'VIDEO_END' || raw === 'ENDED') return 'Video Ended';
  if (raw.includes('LEAVE') || raw.includes('LEFT') || raw.includes('CLOSE')) return 'Left / Closed';
  if (raw === 'SESSION_END' || raw === 'END_SESSION' || raw === 'END') return 'Session Ended';
  return rawType || 'UNKNOWN';
}

function initialsFromName(name: string): string {
  return name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'ST';
}

function resolveAssetUrl(rawUrl?: string): string {
  const value = (rawUrl || '').trim();
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith('//')) return `${window.location.protocol}${value}`;

  const apiBase = typeof api.defaults.baseURL === 'string' ? api.defaults.baseURL : '';
  let origin = window.location.origin;
  if (/^https?:\/\//i.test(apiBase)) {
    try {
      origin = new URL(apiBase).origin;
    } catch {
      // Keep window origin fallback.
    }
  }

  if (value.startsWith('/')) return `${origin}${value}`;
  return `${origin}/${value.replace(/^\/+/, '')}`;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to convert blob to data URL'));
    };
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}

async function loadAvatarImage(rawUrl?: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
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

    const dataUrl = await blobToDataUrl(blob);
    const format = blob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
    return { dataUrl, format };
  } catch {
    return null;
  }
}

// ─── Sinhala Font Registration ────────────────────────────────────────────────

const SINHALA_FONT_URL = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansSinhala/NotoSansSinhala-Regular.ttf';
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

export async function exportStudentWatchDetailPdf(data: any) {
  if (!data) return;

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const student = data.student || {};
  const user = student.user || {};
  const profile = user.profile || {};
  const recording = data.recording || {};
  const cls = data.class || {};
  const month = data.month || {};
  const sessions: any[] = Array.isArray(student.sessions) ? [...student.sessions].reverse() : [];
  const attDetails: any[] = Array.isArray(student.attendanceDetails) ? student.attendanceDetails : [];
  const studentDisplayName = profile.fullName || user.email || 'Student';

  const allActivityEvents: any[] = [
    ...attDetails.map((e: any) => ({ ...e, _source: 'attendance' })),
    ...sessions.flatMap((session: any, index: number) =>
      (Array.isArray(session.events) ? session.events : [])
        .filter((e: any) => {
          const t = String(e?.type || e?.event || '').toUpperCase();
          return !t.includes('HB') && !t.includes('HEARTBEAT') && t !== 'IDLE' && t !== 'FOCUS';
        })
        .map((e: any) => ({ ...e, _source: 'session', _sessionNum: index + 1 })),
    ),
  ].sort((a, b) => {
    const ta = new Date(a.at || a.wallTime || a.timestamp || 0).getTime();
    const tb = new Date(b.at || b.wallTime || b.timestamp || 0).getTime();
    return ta - tb;
  });

  const avatarImage = await loadAvatarImage(profile.avatarUrl);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Register Sinhala font
  const sinhalaLoaded = await registerSinhalaFont(doc);
  const headFont = sinhalaLoaded ? SINHALA_FONT_NAME : 'helvetica';

  const palette = {
    headerDark: [10, 18, 34] as const,
    headerAccent: [8, 145, 178] as const,
    sectionBar: [30, 41, 59] as const,
    tableHead: [30, 41, 59] as const,
    summaryHead: [13, 148, 136] as const,
    card: [248, 250, 252] as const,
    cardBorder: [226, 232, 240] as const,
    text: [15, 23, 42] as const,
    muted: [100, 116, 139] as const,
    white: [255, 255, 255] as const,
    info: [29, 78, 216] as const,
    success: [22, 163, 74] as const,
    warning: [217, 119, 6] as const,
  } as const;

  const sessionEventCount = (session: any): number => {
    if (!Array.isArray(session?.events)) return 0;
    return session.events.filter((event: any) => {
      const type = String(event?.type || event?.event || '').toUpperCase();
      return !type.includes('HB') && !type.includes('HEARTBEAT') && type !== 'IDLE' && type !== 'FOCUS';
    }).length;
  };

  const normalizeSessionStatus = (raw: string | undefined): string => {
    const value = (raw || '').toUpperCase();
    if (value === 'WATCHING') return 'නරඹමින්';
    if (value === 'ENDED') return 'අවසන්';
    if (value === 'PAUSED') return 'විරාම';
    if (value === 'JOINED') return 'සම්බන්ධ වූ';
    return value || '-';
  };

  let y = 38;

  const ensurePageSpace = (neededHeight: number) => {
    if (y + neededHeight <= pageHeight - 14) return;
    doc.addPage();
    y = 16;
  };

  const drawSectionTitle = (title: string, subtitle?: string) => {
    ensurePageSpace(subtitle ? 16 : 11);
    doc.setFillColor(...palette.sectionBar);
    doc.roundedRect(14, y, pageWidth - 28, 8, 1.5, 1.5, 'F');
    doc.setTextColor(...palette.white);
    doc.setFont(headFont, 'bold');
    doc.setFontSize(10.5);
    doc.text(title, 16, y + 5.3);
    y += 10;

    if (subtitle) {
      doc.setTextColor(...palette.muted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(subtitle, 14, y + 2.5);
      y += 5;
    }

    doc.setTextColor(...palette.text);
  };

  const drawMetricCard = (
    x: number,
    title: string,
    value: string,
    subValue: string,
    accent: readonly [number, number, number],
  ) => {
    const cardWidth = (pageWidth - 28 - 6) / 3;
    const cardHeight = 18;
    doc.setFillColor(...palette.card);
    doc.setDrawColor(...palette.cardBorder);
    doc.roundedRect(x, y, cardWidth, cardHeight, 1.8, 1.8, 'FD');

    doc.setFillColor(...accent);
    doc.rect(x, y, 2.4, cardHeight, 'F');

    doc.setTextColor(...palette.muted);
    doc.setFont(headFont, 'bold');
    doc.setFontSize(7.5);
    doc.text(title.toUpperCase(), x + 4, y + 4.7);

    doc.setTextColor(...palette.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(value, x + 4, y + 10.8);

    doc.setTextColor(...palette.muted);
    doc.setFont(headFont, 'normal');
    doc.setFontSize(7.8);
    doc.text(subValue, x + 4, y + 15.2);
  };

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...palette.headerDark);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setFillColor(...palette.headerAccent);
  doc.rect(0, 30, pageWidth, 4, 'F');

  doc.setTextColor(...palette.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Student Watch Report', 14, 11);

  doc.setFont(headFont, 'normal');
  doc.setFontSize(8.8);
  doc.text(`සකස් කළ දිනය: ${fmtDateTime(new Date().toISOString())}`, pageWidth - 14, 10.5, { align: 'right' });
  doc.text(`පන්තිය: ${cls.name || '-'}`, 14, 17);
  doc.text(`මාසය: ${month.name || '-'}`, 14, 22);
  doc.text(`පාඩම: ${recording.title || '-'}`, 14, 27);

  // ── Student card ─────────────────────────────────────────────────────────
  doc.setTextColor(...palette.text);
  doc.setFillColor(...palette.card);
  doc.setDrawColor(...palette.cardBorder);
  doc.roundedRect(14, y, pageWidth - 28, 40, 2, 2, 'FD');

  const avatarX = 18;
  const avatarY = y + 8;
  const avatarSize = 24;
  if (avatarImage) {
    doc.addImage(avatarImage.dataUrl, avatarImage.format, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    doc.setFillColor(...palette.info);
    doc.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 'F');
    doc.setTextColor(...palette.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(initialsFromName(studentDisplayName), avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1.5, {
      align: 'center',
    });
    doc.setTextColor(...palette.text);
  }

  const textX = avatarX + avatarSize + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text(studentDisplayName, textX, y + 12);

  doc.setFont(headFont, 'normal');
  doc.setFontSize(8.8);
  doc.text(`ආයතන හැඳුනුම්පත: ${profile.instituteId || '-'}`, textX, y + 17.5);
  doc.text(`දුරකථන: ${profile.phone || '-'}`, textX, y + 22.2);
  doc.text(`විද්‍යුත් තැපෑල: ${user.email || '-'}`, textX, y + 26.9);

  const statusLine = doc.splitTextToSize(
    `පැමිණීම: ${student.attendanceStatus || 'නොනැරඹූ'} | ගෙවීම: ${student.paymentStatus || 'නොගෙවූ'} | ලියාපදිංචි: ${student.enrolled ? 'ඔව්' : 'නැත'}`,
    pageWidth - textX - 16,
  );
  doc.setTextColor(...palette.muted);
  doc.text(statusLine, textX, y + 31.6);
  doc.setTextColor(...palette.text);

  y += 46;

  // ── Metric cards ──────────────────────────────────────────────────────────
  const colW = (pageWidth - 28 - 6) / 3;
  drawMetricCard(14, 'නැරඹීමේ සැසි', String(student.sessionCount || 0), 'මුළු සැසි ගණන', palette.info);
  drawMetricCard(14 + colW + 3, 'මුළු නැරඹීම', fmtDuration(student.totalWatchedSec || 0), 'සියලු සැසි හරහා', palette.success);
  drawMetricCard(14 + (colW * 2) + 6, 'ක්‍රියාකාරකම් සිදුවීම්', String(allActivityEvents.length), 'පාඩම් + පැමිණීම් සිදුවීම්', palette.warning);

  y += 22;

  const tableStyles = {
    fontSize: 8,
    cellPadding: 2.5,
    lineColor: [palette.cardBorder[0], palette.cardBorder[1], palette.cardBorder[2]] as [number, number, number],
    lineWidth: 0.25,
    textColor: [palette.text[0], palette.text[1], palette.text[2]] as [number, number, number],
    overflow: 'linebreak' as const,
    halign: 'left' as const,
    valign: 'middle' as const,
  };

  // ── Report Overview ───────────────────────────────────────────────────────
  drawSectionTitle('වාර්තා දළ විශ්ලේෂණය', 'පන්ති, පාඩම් සහ කාල සීමා විස්තර');
  autoTable(doc, {
    startY: y,
    head: [['තොරතුර', 'විස්තරය']],
    body: [
      ['පන්තිය', cls.name || '-'],
      ['මාසය', month.name || '-'],
      ['පාඩමේ නම', recording.title || '-'],
      ['පාඩමේ කාලය', recording.duration ? fmtSec(recording.duration) : '-'],
      ['අවසාන නැරඹීම', fmtDateTime(student.lastWatchedAt)],
      ['සජීවී සම්බන්ධය', fmtDateTime(student.liveJoinedAt)],
    ],
    styles: { ...tableStyles, fontSize: 8.6, cellPadding: 3, font: 'helvetica' },
    columnStyles: {
      0: { cellWidth: (pageWidth - 28) * 0.35, fontStyle: 'bold', halign: 'left', font: headFont },
      1: { cellWidth: (pageWidth - 28) * 0.65, halign: 'left' },
    },
    headStyles: { fillColor: [...palette.tableHead], textColor: [...palette.white], fontStyle: 'bold', fontSize: 8.8, halign: 'left', font: headFont },
    alternateRowStyles: { fillColor: [...palette.card] },
    margin: { left: 14, right: 14 },
    theme: 'grid',
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 5;

  autoTable(doc, {
    startY: y,
    head: [['සැසි', 'මුළු නැරඹීම', 'පැමිණීමේ නැරඹීම', 'පැමිණීමේ තත්ත්වය', 'ගෙවීම් තත්ත්වය', 'සිදුවීම්']],
    body: [[
      String(student.sessionCount || 0),
      fmtDuration(student.totalWatchedSec || 0),
      fmtDuration(student.attendanceWatchedSec || 0),
      student.attendanceStatus || 'නොනැරඹූ',
      student.paymentStatus || 'නොගෙවූ',
      String(allActivityEvents.length),
    ]],
    styles: { ...tableStyles, fontSize: 8.4, halign: 'center', font: 'helvetica' },
    columnStyles: {
      0: { cellWidth: (pageWidth - 28) / 6 },
      1: { cellWidth: (pageWidth - 28) / 6 },
      2: { cellWidth: (pageWidth - 28) / 6 },
      3: { cellWidth: (pageWidth - 28) / 6, font: headFont },
      4: { cellWidth: (pageWidth - 28) / 6, font: headFont },
      5: { cellWidth: (pageWidth - 28) / 6 },
    },
    headStyles: { fillColor: [...palette.summaryHead], textColor: [...palette.white], fontStyle: 'bold', fontSize: 8.6, halign: 'center', font: headFont },
    margin: { left: 14, right: 14 },
    theme: 'grid',
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 6;

  // ── Watch Sessions ────────────────────────────────────────────────────────
  drawSectionTitle(`නැරඹීමේ සැසි (${sessions.length})`, 'සැසි මට්ටමේ නැරඹීමේ හැසිරීම සහ ක්‍රියාකාරකම් ගණන');
  autoTable(doc, {
    startY: y,
    head: [['#', 'තත්ත්වය', 'ආරම්භය', 'අවසානය', 'නැරඹීම', 'සැබෑ කාලය', 'සක්‍රිය', 'සිදුවීම්', 'වීඩියෝ පරාසය']],
    body:
      sessions.length > 0
        ? sessions.map((session: any, i: number) => {
            const realDur = calcRealDuration(session);
            const active = calcActivePercent(session);
            return [
              String(i + 1),
              normalizeSessionStatus(session.status),
              fmtDateTime(session.startedAt),
              fmtDateTime(session.endedAt),
              fmtDuration(session.totalWatchedSec || 0),
              fmtDuration(realDur),
              `${active}%`,
              String(sessionEventCount(session)),
              `${fmtSec(session.videoStartPos || 0)} → ${fmtSec(session.videoEndPos || 0)}`,
            ];
          })
        : [['-', '-', '-', '-', '-', '-', '-', '-', '-']],
    styles: { ...tableStyles, fontSize: 7.6, cellPadding: 2.2, font: 'helvetica' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 16, halign: 'center', font: headFont },
      2: { cellWidth: 26 },
      3: { cellWidth: 26 },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 12, halign: 'center' },
      8: { cellWidth: 30 },
    },
    headStyles: { fillColor: [...palette.tableHead], textColor: [...palette.white], fontStyle: 'bold', fontSize: 8, halign: 'center', font: headFont },
    alternateRowStyles: { fillColor: [...palette.card] },
    margin: { left: 14, right: 14 },
    theme: 'grid',
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 6;

  // ── Activity Timeline ─────────────────────────────────────────────────────
  drawSectionTitle(`ක්‍රියාකාරකම් කාලරේඛාව (${allActivityEvents.length})`, 'කාලානුක්‍රමික පිළිවෙලින් නැරඹීමේ ක්‍රියාකාරකම් සහ පැමිණීමේ සිදුවීම්');
  autoTable(doc, {
    startY: y,
    head: [['කවදා', 'ක්‍රියාකාරකම', 'මූලාශ්‍රය', 'වීඩියෝ ස්ථානය', 'නැරඹූ කාලය', 'විස්තරය']],
    body:
      allActivityEvents.length > 0
        ? allActivityEvents.slice(0, 50).map((evt: any) => {
            const raw = String(evt.type || evt.event || 'UNKNOWN');
            const when = fmtDateTime(evt.at || evt.wallTime || evt.timestamp);
            const source =
              evt._source === 'session'
                ? `සැසිය${evt._sessionNum ? ` #${evt._sessionNum}` : ''}`
                : 'පැමිණීම';
            const videoTime = evt.videoTime ?? evt.videoPosition;
            const seekFrom = evt.seekFrom ?? evt.fromVideoTime;
            const seekTo = evt.seekTo ?? evt.toVideoTime;
            const details =
              seekFrom != null && seekTo != null
                ? `${fmtSec(Number(seekFrom))} → ${fmtSec(Number(seekTo))}`
                : evt.note || evt.reason || '-';

            return [
              when,
              activityLabel(raw),
              source,
              videoTime != null ? fmtSec(Number(videoTime)) : '-',
              evt.watchedSec != null ? fmtDuration(Number(evt.watchedSec)) : '-',
              String(details),
            ];
          })
        : [['-', '-', '-', '-', '-', '-']],
    styles: { ...tableStyles, fontSize: 7.4, cellPadding: 2, font: 'helvetica' },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 40 },
      2: { cellWidth: 20, halign: 'center', font: headFont },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 32 },
    },
    headStyles: { fillColor: [...palette.tableHead], textColor: [...palette.white], fontStyle: 'bold', fontSize: 8, halign: 'left', font: headFont },
    alternateRowStyles: { fillColor: [...palette.card] },
    margin: { left: 14, right: 14, bottom: 10 },
    theme: 'grid',
  });

  // ── Footer on every page ──────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(...palette.cardBorder);
    doc.line(14, pageHeight - 9, pageWidth - 14, pageHeight - 9);
    doc.setFontSize(8);
    doc.setTextColor(...palette.muted);
    doc.setFont(headFont, 'normal');
    doc.text(`සිසුවා: ${studentDisplayName}`, 14, pageHeight - 4.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Thilina Dhananjaya LMS', pageWidth / 2, pageHeight - 4.5, { align: 'center' });
    doc.setFont(headFont, 'normal');
    doc.text(`පිටුව ${page} / ${pageCount}`, pageWidth - 14, pageHeight - 4.5, { align: 'right' });
  }

  const fileName = cleanFileName(
    `Student-Watch-Detail-${studentDisplayName}-${recording.title || 'Recording'}.pdf`,
  );
  doc.save(fileName);
}
