import api from './api';

export type RecordingReportMode = 'SUMMARY' | 'FULL';

export interface StudentClassReportPayload {
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

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
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

function fmtMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  const rounded = Math.round(value * 100) / 100;
  return `Rs. ${rounded.toLocaleString('en-LK', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function cleanFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

function initialsFromName(name: string): string {
  return (
    name
      .split(' ')
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
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

async function loadAvatarImage(rawUrl?: string | null): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  const resolved = resolveAssetUrl(rawUrl || '');
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
    return {
      dataUrl,
      format: blob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG',
    };
  } catch {
    return null;
  }
}

function normalizePaymentLabel(raw: string | null | undefined): string {
  const value = (raw || '').trim().toUpperCase();
  if (value === 'PAID' || value === 'VERIFIED') return 'Paid';
  if (value === 'PENDING') return 'Pending';
  if (value === 'LATE') return 'Late';
  if (value === 'UNPAID' || value === 'REJECTED') return 'Unpaid';
  return value || '-';
}

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
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const studentName = payload.student.fullName || payload.student.email || 'Student';
  const avatarImage = await loadAvatarImage(payload.student.avatarUrl);

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 25, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Student Report', 14, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, pageWidth - 14, 10, { align: 'right' });
  doc.text(`Class: ${payload.classInfo.name || '-'}`, 14, 16.5);
  doc.text(`Subject: ${payload.classInfo.subject || '-'}`, 14, 21);

  doc.setTextColor(20, 20, 20);

  let y = 31;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, 33, 2, 2, 'FD');

  const avatarX = 18;
  const avatarY = y + 4.5;
  const avatarSize = 24;

  if (avatarImage) {
    doc.addImage(avatarImage.dataUrl, avatarImage.format, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    doc.setFillColor(59, 130, 246);
    doc.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(initialsFromName(studentName), avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1.5, { align: 'center' });
    doc.setTextColor(20, 20, 20);
  }

  const textX = avatarX + avatarSize + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(studentName, textX, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Institute ID: ${payload.student.instituteId || '-'}`, textX, y + 15.5);
  doc.text(`Email: ${payload.student.email || '-'}`, textX, y + 20.5);
  doc.text(`Phone: ${payload.student.phone || '-'}`, textX, y + 25.5);
  doc.text(
    `Payment Type: ${payload.student.paymentType || '-'} | Monthly Fee: ${fmtMoney(payload.student.effectiveMonthlyFee)}`,
    textX,
    y + 30,
  );

  y += 38;

  const ensurePageSpace = (neededHeight: number) => {
    if (y + neededHeight <= pageHeight - 14) return;
    doc.addPage();
    y = 16;
  };

  const drawSectionTitle = (title: string) => {
    ensurePageSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(title, 14, y);
    doc.setFont('helvetica', 'normal');
    y += 2;
  };

  if (payload.options.includePayments) {
    drawSectionTitle('Payments History');

    const paymentRows = payload.payments?.rows || [];
    if (paymentRows.length > 0) {
      autoTable(doc, {
        startY: y + 2,
        head: [['Month', 'Status', 'Slips', 'Latest Slip Status']],
        body: paymentRows.map((row) => [
          row.label,
          normalizePaymentLabel(row.status),
          String(row.slipCount || 0),
          normalizePaymentLabel(row.latestSlipStatus),
        ]),
        styles: { fontSize: 8.5, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid',
      });
      y = ((doc as any).lastAutoTable?.finalY || y) + 2;

      autoTable(doc, {
        startY: y,
        head: [['Paid', 'Pending', 'Unpaid']],
        body: [[
          String(payload.payments?.paidCount || 0),
          String(payload.payments?.pendingCount || 0),
          String(payload.payments?.unpaidCount || 0),
        ]],
        styles: { fontSize: 8.5, cellPadding: 2, halign: 'center' },
        headStyles: { fillColor: [15, 118, 110] },
        theme: 'grid',
      });
      y = ((doc as any).lastAutoTable?.finalY || y) + 5;
    } else {
      doc.setFontSize(9);
      doc.text('No payment rows found for this class.', 14, y + 7);
      y += 10;
    }
  }

  if (payload.options.includePhysicalAttendance) {
    drawSectionTitle('Physical Attendance');

    autoTable(doc, {
      startY: y + 2,
      head: [['Total', 'Present', 'Late', 'Absent', 'Excused', 'Attendance %']],
      body: [[
        String(payload.physicalAttendance?.summary.total || 0),
        String(payload.physicalAttendance?.summary.present || 0),
        String(payload.physicalAttendance?.summary.late || 0),
        String(payload.physicalAttendance?.summary.absent || 0),
        String(payload.physicalAttendance?.summary.excused || 0),
        `${payload.physicalAttendance?.summary.percentage || 0}%`,
      ]],
      styles: { fontSize: 8.5, cellPadding: 2, halign: 'center' },
      headStyles: { fillColor: [30, 64, 175] },
      theme: 'grid',
    });
    y = ((doc as any).lastAutoTable?.finalY || y) + 2;

    const physicalRows = payload.physicalAttendance?.rows || [];
    if (physicalRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Session', 'Time', 'Status']],
        body: physicalRows.map((row) => [row.date, row.session || '-', row.sessionTime || '-', row.status || '-']),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid',
      });
      y = ((doc as any).lastAutoTable?.finalY || y) + 5;
    } else {
      doc.setFontSize(9);
      doc.text('No physical attendance records found.', 14, y + 6);
      y += 10;
    }
  }

  if (payload.options.includeRecordingAttendance) {
    drawSectionTitle('Recording Attendance');

    const recordingSummaryRows = payload.recordingAttendance?.summaryRows || [];
    if (recordingSummaryRows.length > 0) {
      autoTable(doc, {
        startY: y + 2,
        head: [['Recording', 'Month', 'Sessions', 'Watched Time', 'Last Watch']],
        body: recordingSummaryRows.map((row) => [
          row.title || '-',
          row.month || '-',
          String(row.sessions || 0),
          fmtDuration(row.watchedSec || 0),
          fmtDateTime(row.lastWatchedAt),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid',
      });
      y = ((doc as any).lastAutoTable?.finalY || y) + 3;
    } else {
      doc.setFontSize(9);
      doc.text('No recording activity found.', 14, y + 6);
      y += 9;
    }

    if (payload.options.recordingMode === 'FULL') {
      const sessionRows = payload.recordingAttendance?.sessionRows || [];
      drawSectionTitle('Recording Session Details');
      if (sessionRows.length > 0) {
        autoTable(doc, {
          startY: y + 2,
          head: [['Recording', 'Started', 'Ended', 'Watched', 'Status']],
          body: sessionRows.map((row) => [
            row.title || '-',
            fmtDateTime(row.startedAt),
            fmtDateTime(row.endedAt),
            fmtDuration(row.watchedSec || 0),
            row.status || '-',
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [30, 41, 59] },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          theme: 'grid',
        });
        y = ((doc as any).lastAutoTable?.finalY || y) + 5;
      } else {
        doc.setFontSize(9);
        doc.text('No session details found.', 14, y + 6);
        y += 10;
      }
    }
  }

  if (
    !payload.options.includePayments
    && !payload.options.includePhysicalAttendance
    && !payload.options.includeRecordingAttendance
  ) {
    ensurePageSpace(16);
    doc.setFontSize(10);
    doc.text('No report sections were selected.', 14, y + 6);
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 9, pageWidth - 14, pageHeight - 9);
    doc.setTextColor(110);
    doc.setFontSize(8);
    doc.text(`Student: ${studentName}`, 14, pageHeight - 4.5);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 14, pageHeight - 4.5, { align: 'right' });
  }

  return doc.output('blob');
}

export function normalizeDateLabel(year: number, month: number, name?: string): string {
  if (name && name.trim()) return name.trim();
  const d = new Date(year, month - 1, 1);
  if (Number.isNaN(d.getTime())) return `${year}-${String(month).padStart(2, '0')}`;
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function normalizePhysicalDate(dateText: string): string {
  if (!dateText) return '-';
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  return fmtDate(date.toISOString());
}
