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

  const palette = {
    headerDark: [10, 18, 34] as [number, number, number],
    headerAccent: [8, 145, 178] as [number, number, number],
    sectionBar: [30, 41, 59] as [number, number, number],
    tableHead: [30, 41, 59] as [number, number, number],
    summaryHead: [13, 148, 136] as [number, number, number],
    card: [248, 250, 252] as [number, number, number],
    cardBorder: [226, 232, 240] as [number, number, number],
    text: [15, 23, 42] as [number, number, number],
    muted: [100, 116, 139] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    info: [29, 78, 216] as [number, number, number],
    success: [22, 163, 74] as [number, number, number],
    warning: [217, 119, 6] as [number, number, number],
  };

  const sessionEventCount = (session: any): number => {
    if (!Array.isArray(session?.events)) return 0;
    return session.events.filter((event: any) => {
      const type = String(event?.type || event?.event || '').toUpperCase();
      return !type.includes('HB') && !type.includes('HEARTBEAT') && type !== 'IDLE' && type !== 'FOCUS';
    }).length;
  };

  const normalizeSessionStatus = (raw: string | undefined): string => {
    const value = (raw || '').toUpperCase();
    if (value === 'WATCHING') return 'Watching';
    if (value === 'ENDED') return 'Ended';
    if (value === 'PAUSED') return 'Paused';
    if (value === 'JOINED') return 'Joined';
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
    doc.setFont('helvetica', 'bold');
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

  const drawMetricCard = (x: number, title: string, value: string, subValue: string, accent: readonly [number, number, number]) => {
    const cardWidth = (pageWidth - 28 - 6) / 3;
    const cardHeight = 18;
    doc.setFillColor(...palette.card);
    doc.setDrawColor(...palette.cardBorder);
    doc.roundedRect(x, y, cardWidth, cardHeight, 1.8, 1.8, 'FD');

    doc.setFillColor(...accent);
    doc.rect(x, y, 2.4, cardHeight, 'F');

    doc.setTextColor(...palette.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(title.toUpperCase(), x + 4, y + 4.7);

    doc.setTextColor(...palette.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(value, x + 4, y + 10.8);

    doc.setTextColor(...palette.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.text(subValue, x + 4, y + 15.2);
  };

  doc.setFillColor(...palette.headerDark);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setFillColor(...palette.headerAccent);
  doc.rect(0, 30, pageWidth, 4, 'F');

  doc.setTextColor(...palette.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Student Watch Report', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, pageWidth - 14, 10.5, { align: 'right' });
  doc.text(`Class: ${cls.name || '-'}`, 14, 17);
  doc.text(`Month: ${month.name || '-'}`, 14, 22);
  doc.text(`Recording: ${recording.title || '-'}`, 14, 27);

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
    doc.text(initialsFromName(studentDisplayName), avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1.5, { align: 'center' });
    doc.setTextColor(...palette.text);
  }

  const textX = avatarX + avatarSize + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text(studentDisplayName, textX, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.text(`Institute ID: ${profile.instituteId || '-'}`, textX, y + 17.5);
  doc.text(`Phone: ${profile.phone || '-'}`, textX, y + 22.2);
  doc.text(`Email: ${user.email || '-'}`, textX, y + 26.9);

  const statusLine = doc.splitTextToSize(
    `Attendance: ${student.attendanceStatus || 'NOT VIEWED'} | Payment: ${student.paymentStatus || 'UNPAID'} | Enrolled: ${student.enrolled ? 'Yes' : 'No'}`,
    pageWidth - textX - 16,
  );
  doc.setTextColor(...palette.muted);
  doc.text(statusLine, textX, y + 31.6);
  doc.setTextColor(...palette.text);

  y += 46;

  drawMetricCard(14, 'Watch Sessions', String(student.sessionCount || 0), 'Total sessions captured', palette.info);
  drawMetricCard(14 + ((pageWidth - 28 - 6) / 3) + 3, 'Total Watched', fmtDuration(student.totalWatchedSec || 0), 'Across all sessions', palette.success);
  drawMetricCard(14 + (((pageWidth - 28 - 6) / 3) * 2) + 6, 'Activity Events', String(allActivityEvents.length), 'Playback + attendance events', palette.warning);

  y += 22;

  const tableStyles = {
    fontSize: 8.3,
    cellPadding: 2.1,
    lineColor: palette.cardBorder,
    lineWidth: 0.15,
    textColor: palette.text,
    overflow: 'linebreak' as const,
  };

  drawSectionTitle('Report Overview', 'Core class, recording and timeline metadata');
  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: [
      ['Class', cls.name || '-'],
      ['Month', month.name || '-'],
      ['Recording Title', recording.title || '-'],
      ['Recording Duration', recording.duration ? fmtSec(recording.duration) : '-'],
      ['Last Watch', fmtDateTime(student.lastWatchedAt)],
      ['Live Joined', fmtDateTime(student.liveJoinedAt)],
    ],
    styles: { ...tableStyles, fontSize: 8.8, cellPadding: 2.4 },
    columnStyles: { 0: { cellWidth: 44, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
    headStyles: { fillColor: palette.tableHead, textColor: palette.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: palette.card },
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
    styles: { ...tableStyles, fontSize: 8.7, halign: 'center' },
    headStyles: { fillColor: palette.summaryHead, textColor: palette.white, fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
    theme: 'grid',
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 6;

  drawSectionTitle(`Watch Sessions (${sessions.length})`, 'Session-level watch behavior with event counts and active ratio');
  autoTable(doc, {
    startY: y,
    head: [['#', 'Status', 'Started', 'Ended', 'Watched', 'Real Time', 'Active', 'Events', 'Video Range']],
    body: sessions.length > 0
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
            `${fmtSec(session.videoStartPos || 0)} -> ${fmtSec(session.videoEndPos || 0)}`,
          ];
        })
      : [['-', '-', '-', '-', '-', '-', '-', '-', '-']],
    styles: { ...tableStyles, fontSize: 7.8 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 12, halign: 'center' },
      7: { cellWidth: 12, halign: 'center' },
      8: { cellWidth: 'auto' },
    },
    headStyles: { fillColor: palette.tableHead, textColor: palette.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: palette.card },
    margin: { left: 14, right: 14 },
    theme: 'grid',
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 6;

  drawSectionTitle(`Activity Timeline (${allActivityEvents.length})`, 'Playback actions, seeks and attendance events in chronological order');
  autoTable(doc, {
    startY: y,
    head: [['When', 'Activity', 'Source', 'Video Position', 'Watched Time', 'Details']],
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
      : [['-', '-', '-', '-', '-', '-']],
    styles: { ...tableStyles, fontSize: 7.9 },
    columnStyles: {
      0: { cellWidth: 31 },
      1: { cellWidth: 44 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 'auto' },
    },
    headStyles: { fillColor: palette.tableHead, textColor: palette.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: palette.card },
    margin: { left: 14, right: 14, bottom: 10 },
    theme: 'grid',
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(...palette.cardBorder);
    doc.line(14, pageHeight - 9, pageWidth - 14, pageHeight - 9);
    doc.setFontSize(8);
    doc.setTextColor(...palette.muted);
    doc.text(`Student: ${studentDisplayName}`, 14, pageHeight - 4.5);
    doc.text('Thilina Dhananjaya LMS', pageWidth / 2, pageHeight - 4.5, { align: 'center' });
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 14, pageHeight - 4.5, { align: 'right' });
  }

  const fileName = cleanFileName(
    `Student-Watch-Detail-${studentDisplayName}-${recording.title || 'Recording'}.pdf`,
  );
  doc.save(fileName);
}
