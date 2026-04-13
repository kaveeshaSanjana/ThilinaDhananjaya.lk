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

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Student Watch Detail Report', 14, 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, pageWidth - 14, 10.5, { align: 'right' });
  doc.text(`Class: ${cls.name || '-'}`, 14, 16.5);
  doc.text(`Recording: ${recording.title || '-'}`, 14, 21.5);

  doc.setTextColor(20, 20, 20);

  let y = 31;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, 34, 2, 2, 'FD');

  const avatarX = 18;
  const avatarY = y + 5;
  const avatarSize = 24;
  if (avatarImage) {
    doc.addImage(avatarImage.dataUrl, avatarImage.format, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    doc.setFillColor(59, 130, 246);
    doc.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(initialsFromName(studentDisplayName), avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1.5, { align: 'center' });
    doc.setTextColor(20, 20, 20);
  }

  const textX = avatarX + avatarSize + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text(studentDisplayName, textX, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Institute ID: ${profile.instituteId || '-'}`, textX, y + 16.5);
  doc.text(`Phone: ${profile.phone || '-'}`, textX, y + 21.5);
  doc.text(`Email: ${user.email || '-'}`, textX, y + 26.5);
  doc.text(
    `Attendance: ${student.attendanceStatus || 'NOT VIEWED'}  |  Payment: ${student.paymentStatus || 'UNPAID'}  |  Enrolled: ${student.enrolled ? 'Yes' : 'No'}`,
    textX,
    y + 31,
  );

  y += 40;

  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: [
      ['Class', cls.name || '-'],
      ['Month', month.name || '-'],
      ['Recording Title', recording.title || '-'],
      ['Recording Duration', recording.duration ? fmtSec(recording.duration) : '-'],
      ['Last Watch Time', fmtDateTime(student.lastWatchedAt)],
      ['Live Joined At', fmtDateTime(student.liveJoinedAt)],
    ],
    styles: { fontSize: 9, cellPadding: 2.3, overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
    headStyles: { fillColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: 'grid',
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 4;

  autoTable(doc, {
    startY: y,
    head: [['Sessions', 'Total Watch', 'Attendance Watch', 'Attendance Status', 'Payment Status']],
    body: [[
      String(student.sessionCount || 0),
      fmtDuration(student.totalWatchedSec || 0),
      fmtDuration(student.attendanceWatchedSec || 0),
      student.attendanceStatus || 'NOT VIEWED',
      student.paymentStatus || 'UNPAID',
    ]],
    styles: { fontSize: 9.2, cellPadding: 2.5, halign: 'center' },
    headStyles: { fillColor: [15, 118, 110] },
    theme: 'grid',
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Watch Sessions (${sessions.length})`, 14, y);
  doc.setFont('helvetica', 'normal');

  autoTable(doc, {
    startY: y + 2,
    head: [['#', 'Status', 'Started', 'Ended', 'Watched', 'Real Time', 'Active %', 'Video Range']],
    body: sessions.length > 0
      ? sessions.map((session: any, i: number) => {
          const realDur = calcRealDuration(session);
          const active = calcActivePercent(session);
          return [
            String(i + 1),
            session.status || '-',
            fmtDateTime(session.startedAt),
            fmtDateTime(session.endedAt),
            fmtDuration(session.totalWatchedSec || 0),
            fmtDuration(realDur),
            `${active}%`,
            `${fmtSec(session.videoStartPos || 0)} -> ${fmtSec(session.videoEndPos || 0)}`,
          ];
        })
      : [['-', '-', '-', '-', '-', '-', '-', '-']],
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 19, halign: 'center' },
      2: { cellWidth: 34 },
      3: { cellWidth: 34 },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 'auto' },
    },
    headStyles: { fillColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    theme: 'grid',
  });

  const tableY = ((doc as any).lastAutoTable?.finalY || 0) + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Activity Timeline (${allActivityEvents.length})`, 14, tableY);
  doc.setFont('helvetica', 'normal');

  autoTable(doc, {
    startY: tableY + 2,
    head: [['When', 'Event', 'Source', 'Video Time', 'Watched']],
    body: allActivityEvents.length > 0
      ? allActivityEvents.map((evt: any) => {
          const raw = String(evt.type || evt.event || 'UNKNOWN');
          const when = fmtDateTime(evt.at || evt.wallTime || evt.timestamp);
          const source = evt._source === 'session'
            ? `Session${evt._sessionNum ? ` #${evt._sessionNum}` : ''}`
            : 'Attendance';
          const vTime = evt.videoTime ?? evt.videoPosition;
          return [
            when,
            activityLabel(raw),
            source,
            vTime != null ? fmtSec(Number(vTime)) : '-',
            evt.watchedSec != null ? fmtDuration(Number(evt.watchedSec)) : '-',
          ];
        })
      : [['-', '-', '-', '-', '-']],
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 66 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 'auto', halign: 'center' },
    },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    theme: 'grid',
    margin: { bottom: 10 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 9, pageWidth - 14, pageHeight - 9);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`Student: ${studentDisplayName}`, 14, pageHeight - 4.5);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 14, pageHeight - 4.5, { align: 'right' });
  }

  const fileName = cleanFileName(
    `Student-Watch-Detail-${studentDisplayName}.pdf`,
  );
  doc.save(fileName);
}
