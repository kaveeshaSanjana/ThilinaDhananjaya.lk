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

  const palette = {
    headerDark: [10, 18, 34] as const,
    headerAccent: [8, 145, 178] as const,
    sectionBar: [30, 64, 175] as const,
    tableHead: [30, 64, 175] as const,
    summaryHead: [14, 116, 236] as const,
    card: [248, 250, 252] as const,
    cardBorder: [226, 232, 240] as const,
    text: [15, 23, 42] as const,
    muted: [100, 116, 139] as const,
    white: [255, 255, 255] as const,
    info: [29, 78, 216] as const,
  };

  const studentName = payload.student.fullName || payload.student.email || 'Student';
  const avatarImage = await loadAvatarImage(payload.student.avatarUrl);

  const includedSections = [
    payload.options.includePayments ? 'Payments' : null,
    payload.options.includePhysicalAttendance ? 'Physical Attendance' : null,
    payload.options.includeRecordingAttendance ? 'Recording Attendance' : null,
  ].filter((value): value is string => Boolean(value));

  const recordingModeLabel = payload.options.recordingMode === 'FULL'
    ? 'Full details'
    : 'Summary only';

  doc.setFillColor(...palette.headerDark);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setFillColor(...palette.headerAccent);
  doc.rect(0, 30, pageWidth, 4, 'F');

  doc.setTextColor(...palette.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  doc.text('Student Class Report', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, pageWidth - 14, 10.5, { align: 'right' });
  doc.text(`Class: ${payload.classInfo.name || '-'}`, 14, 17);
  doc.text(`Subject: ${payload.classInfo.subject || '-'}`, 14, 22);
  doc.text(`Sections: ${includedSections.length > 0 ? includedSections.join(', ') : '-'}`, 14, 27);

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

  const drawEmptyState = (message: string) => {
    ensurePageSpace(12);
    doc.setFillColor(...palette.card);
    doc.setDrawColor(...palette.cardBorder);
    doc.roundedRect(14, y, pageWidth - 28, 8, 1.5, 1.5, 'FD');
    doc.setTextColor(...palette.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.6);
    doc.text(message, 16, y + 5.2);
    doc.setTextColor(...palette.text);
    y += 11;
  };

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
    doc.setFontSize(11.5);
    doc.text(initialsFromName(studentName), avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 1.5, { align: 'center' });
    doc.setTextColor(...palette.text);
  }

  const textX = avatarX + avatarSize + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.3);
  doc.text(studentName, textX, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.text(`Institute Student ID: ${payload.student.instituteId || '-'}`, textX, y + 17.5);
  doc.text(`Email: ${payload.student.email || '-'}`, textX, y + 22.2);
  doc.text(`Phone: ${payload.student.phone || '-'}`, textX, y + 26.9);

  const profileLine = doc.splitTextToSize(
    `Payment Type: ${payload.student.paymentType || '-'} | Monthly Fee: ${fmtMoney(payload.student.effectiveMonthlyFee)} | Recording Mode: ${recordingModeLabel}`,
    pageWidth - textX - 16,
  );
  doc.setTextColor(...palette.muted);
  doc.text(profileLine, textX, y + 31.6);
  doc.setTextColor(...palette.text);

  y += 46;

  const tableStyles = {
    fontSize: 8.3,
    cellPadding: 2.1,
    lineColor: [219, 234, 254],
    lineWidth: 0,
    textColor: [...palette.text],
    overflow: 'linebreak' as const,
  };

  const drawCurvedTableBorder = (tableStartY: number) => {
    const lastTable = (doc as any).lastAutoTable;
    if (!lastTable) return;

    const startPage = Number(lastTable.startPageNumber || doc.getNumberOfPages());
    const currentPage = Number((doc as any).internal?.getCurrentPageInfo?.().pageNumber || doc.getNumberOfPages());
    if (startPage !== currentPage) return;

    const effectiveStartY = Number(lastTable.settings?.startY || tableStartY);
    const finalY = Number(lastTable.finalY || tableStartY);
    const top = Math.max(12, effectiveStartY - 1.6);
    const height = Math.max(8, finalY - effectiveStartY + 3.2);

    doc.setDrawColor(191, 219, 254);
    doc.setLineWidth(0.35);
    doc.roundedRect(14.8, top, pageWidth - 29.6, height, 2.2, 2.2, 'S');
    doc.setLineWidth(0.2);
  };

  const renderBlueTable = (config: Record<string, any>, gapAfter = 6) => {
    const tableStartY = Number(config.startY || y);

    autoTable(doc, {
      ...config,
      margin: config.margin || { left: 16, right: 16 },
      theme: config.theme || 'striped',
      styles: {
        ...tableStyles,
        ...(config.styles || {}),
      },
      headStyles: {
        fillColor: [...palette.tableHead],
        textColor: [...palette.white],
        fontStyle: 'bold',
        ...(config.headStyles || {}),
      },
      alternateRowStyles: {
        fillColor: [243, 248, 255],
        ...(config.alternateRowStyles || {}),
      },
    });

    drawCurvedTableBorder(tableStartY);
    y = ((doc as any).lastAutoTable?.finalY || y) + gapAfter;
  };

  if (payload.options.includePayments) {
    const paymentRows = payload.payments?.rows || [];
    drawSectionTitle('Payments History', `${paymentRows.length} monthly record(s)`);

    if (paymentRows.length > 0) {
      renderBlueTable({
        startY: y,
        head: [['Month', 'Status', 'Slips', 'Latest Slip Status']],
        body: paymentRows.map((row) => [
          row.label,
          normalizePaymentLabel(row.status),
          String(row.slipCount || 0),
          normalizePaymentLabel(row.latestSlipStatus),
        ]),
        styles: { fontSize: 8.5 },
      }, 3);

      renderBlueTable({
        startY: y,
        head: [['Paid', 'Pending', 'Unpaid']],
        body: [[
          String(payload.payments?.paidCount || 0),
          String(payload.payments?.pendingCount || 0),
          String(payload.payments?.unpaidCount || 0),
        ]],
        styles: { fontSize: 8.7, halign: 'center' },
        headStyles: { fillColor: [...palette.summaryHead] },
      }, 6);
    } else {
      drawEmptyState('No payment rows found for this class.');
    }
  }

  if (payload.options.includePhysicalAttendance) {
    const percentage = payload.physicalAttendance?.summary.percentage || 0;
    drawSectionTitle('Physical Attendance', `Overall attendance: ${percentage}%`);

    renderBlueTable({
      startY: y,
      head: [['Total', 'Present', 'Late', 'Absent', 'Excused', 'Attendance %']],
      body: [[
        String(payload.physicalAttendance?.summary.total || 0),
        String(payload.physicalAttendance?.summary.present || 0),
        String(payload.physicalAttendance?.summary.late || 0),
        String(payload.physicalAttendance?.summary.absent || 0),
        String(payload.physicalAttendance?.summary.excused || 0),
        `${percentage}%`,
      ]],
      styles: { fontSize: 8.6, halign: 'center' },
      headStyles: { fillColor: [...palette.summaryHead] },
    }, 3);

    const physicalRows = payload.physicalAttendance?.rows || [];
    if (physicalRows.length > 0) {
      renderBlueTable({
        startY: y,
        head: [['Date', 'Session', 'Time', 'Status']],
        body: physicalRows.map((row) => [row.date, row.session || '-', row.sessionTime || '-', row.status || '-']),
        styles: { fontSize: 8.1 },
      }, 6);
    } else {
      drawEmptyState('No physical attendance records found.');
    }
  }

  if (payload.options.includeRecordingAttendance) {
    const recordingSummaryRows = payload.recordingAttendance?.summaryRows || [];
    drawSectionTitle('Recording Attendance', `${recordingSummaryRows.length} recording(s) tracked`);

    if (recordingSummaryRows.length > 0) {
      renderBlueTable({
        startY: y,
        head: [['Recording', 'Month', 'Sessions', 'Watched Time', 'Last Watch']],
        body: recordingSummaryRows.map((row) => [
          row.title || '-',
          row.month || '-',
          String(row.sessions || 0),
          fmtDuration(row.watchedSec || 0),
          fmtDateTime(row.lastWatchedAt),
        ]),
        styles: { fontSize: 8.1 },
      }, 4);
    } else {
      drawEmptyState('No recording activity found.');
    }

    if (payload.options.recordingMode === 'FULL') {
      const sessionRows = payload.recordingAttendance?.sessionRows || [];
      drawSectionTitle('Recording Session Details', `${sessionRows.length} session row(s)`);

      if (sessionRows.length > 0) {
        renderBlueTable({
          startY: y,
          head: [['Recording', 'Started', 'Ended', 'Watched', 'Status']],
          body: sessionRows.map((row) => [
            row.title || '-',
            fmtDateTime(row.startedAt),
            fmtDateTime(row.endedAt),
            fmtDuration(row.watchedSec || 0),
            row.status || '-',
          ]),
          styles: { fontSize: 8.1 },
        }, 6);
      } else {
        drawEmptyState('No recording session details found.');
      }
    }
  }

  if (
    !payload.options.includePayments
    && !payload.options.includePhysicalAttendance
    && !payload.options.includeRecordingAttendance
  ) {
    drawSectionTitle('No Sections Selected');
    drawEmptyState('Choose at least one section (payments, physical or recording attendance) before exporting.');
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(...palette.cardBorder);
    doc.line(14, pageHeight - 9, pageWidth - 14, pageHeight - 9);
    doc.setTextColor(...palette.muted);
    doc.setFontSize(8);
    doc.text(`Class: ${payload.classInfo.name || '-'}`, 14, pageHeight - 4.5);
    doc.text(`Student: ${studentName}`, pageWidth / 2, pageHeight - 4.5, { align: 'center' });
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
