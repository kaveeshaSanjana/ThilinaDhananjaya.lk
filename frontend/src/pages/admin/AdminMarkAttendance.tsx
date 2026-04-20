import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { getInstituteAdminPath } from '../../lib/instituteRoutes';

type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

interface ClassItem {
  id: string;
  name: string;
  subject?: string;
}

interface ClassStudentItem {
  userId: string;
  fullName: string;
  instituteId: string;
  barcodeId?: string | null;
  avatarUrl?: string | null;
}

interface ScanLogItem {
  id: string;
  name: string;
  time: string;
  ok: boolean;
  message?: string;
}

interface ScanResultPopup {
  status: 'success' | 'error';
  name: string;
  identifier: string;
  avatarUrl?: string;
  instituteId?: string;
  barcodeId?: string;
  userId?: string;
  message?: string;
  sessionTime?: string;
  sessionCode?: string;
}

interface CameraDeviceOption {
  deviceId: string;
  label: string;
  isVirtual: boolean;
}

function toDateStr(date: Date) {
  return date.toISOString().split('T')[0];
}

function toTimeStr(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function normalizeScannedIdentifier(raw: string) {
  return raw.trim();
}

function readText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function pickText(...values: unknown[]) {
  for (const value of values) {
    const text = readText(value);
    if (text) return text;
  }
  return '';
}

function normalizeClassStudentItem(raw: unknown): ClassStudentItem | null {
  if (!raw || typeof raw !== 'object') return null;

  const row = raw as Record<string, unknown>;
  const user = row.user && typeof row.user === 'object' ? row.user as Record<string, unknown> : undefined;
  const profile = row.profile && typeof row.profile === 'object'
    ? row.profile as Record<string, unknown>
    : user?.profile && typeof user.profile === 'object'
      ? user.profile as Record<string, unknown>
      : undefined;

  const userId = pickText(row.userId, user?.id, row.id, profile?.userId);
  if (!userId) return null;

  const fullName = pickText(row.fullName, profile?.fullName, user?.name, user?.email, userId);
  const instituteId = pickText(row.instituteId, profile?.instituteId);
  const barcodeId = pickText(row.barcodeId, profile?.barcodeId) || null;
  const avatarUrl = pickText(row.avatarUrl, profile?.avatarUrl) || null;

  return {
    userId,
    fullName,
    instituteId: instituteId || '-',
    barcodeId,
    avatarUrl,
  };
}

function findStudentByIdentifier(identifier: string, students: ClassStudentItem[]) {
  const token = identifier.trim().toLowerCase();
  if (!token) return undefined;

  return students.find((student) => {
    const barcode = (student.barcodeId || '').trim().toLowerCase();
    const institute = (student.instituteId || '').trim().toLowerCase();
    const userId = (student.userId || '').trim().toLowerCase();
    return token === barcode || token === institute || token === userId;
  });
}

const CAMERA_FACING_MODE_STORAGE_KEY = 'mark-attendance:camera-facing-mode';
const CAMERA_DEVICE_ID_STORAGE_KEY = 'mark-attendance:camera-device-id';
const BARCODE_ROUTE_MODE_STORAGE_KEY = 'mark-attendance:barcode-route-mode';
const VIRTUAL_CAMERA_HINTS = ['virtual', 'obs', 'snap camera', 'manycam', 'xsplit', 'ndi'];

function getDefaultFacingMode(): 'environment' | 'user' {
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /android|iphone|ipad|ipod|mobile/.test(ua);
    return isMobile ? 'environment' : 'user';
  }
  return 'user';
}

function readStoredFacingMode(): 'environment' | 'user' | null {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(CAMERA_FACING_MODE_STORAGE_KEY);
  if (value === 'environment' || value === 'user') return value;
  return null;
}

function readStoredCameraDeviceId() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(CAMERA_DEVICE_ID_STORAGE_KEY) || '';
}

function readStoredBarcodeRouteMode(): 'auto' | 'by-barcode' | 'legacy' {
  if (typeof window === 'undefined') return 'auto';
  const value = localStorage.getItem(BARCODE_ROUTE_MODE_STORAGE_KEY);
  if (value === 'by-barcode' || value === 'legacy' || value === 'auto') return value;
  return 'auto';
}

function isLikelyVirtualCameraLabel(label: string) {
  const lower = label.toLowerCase();
  return VIRTUAL_CAMERA_HINTS.some((hint) => lower.includes(hint));
}

function resolveAvatarUrl(rawUrl?: string) {
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
      // Keep current origin fallback.
    }
  }

  if (value.startsWith('/')) return `${origin}${value}`;
  return `${origin}/${value.replace(/^\/+/, '')}`;
}

function extractApiErrorMessage(error: any): string {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string') return message;
  if (typeof error?.response?.data === 'string') return error.response.data;
  if (typeof error?.message === 'string') return error.message;
  return '';
}

function isMissingRoute404(error: any, routeKey: string): boolean {
  if (error?.response?.status !== 404) return false;
  const msg = extractApiErrorMessage(error).toLowerCase();
  const key = routeKey.toLowerCase();
  return msg.includes('cannot post') || msg.includes(key);
}

function useCameraScanner(onScan: (value: string) => void, facingMode: 'environment' | 'user', preferredDeviceId: string) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const frameRef = useRef<number | null>(null);
  const onScanRef = useRef(onScan);
  const keyboardBufferRef = useRef('');
  const keyboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmitRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });
  const openingRef = useRef(false);
  const openRequestRef = useRef(0);

  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [videoDevices, setVideoDevices] = useState<CameraDeviceOption[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState('');

  const stopCamera = useCallback(() => {
    openRequestRef.current += 1;
    openingRef.current = false;
    setStarting(false);

    try {
      zxingControlsRef.current?.stop();
    } catch {
      // Ignore stop race errors.
    }
    zxingControlsRef.current = null;

    if (frameRef.current != null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;

    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
      } catch {
        // Ignore pause errors.
      }
      video.srcObject = null;
    }

    setActive(false);
  }, []);

  const refreshVideoDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => {
          const rawLabel = (device.label || '').trim();
          return {
            deviceId: device.deviceId,
            label: rawLabel || `Camera ${index + 1}`,
            isVirtual: isLikelyVirtualCameraLabel(rawLabel),
          } satisfies CameraDeviceOption;
        });
      setVideoDevices(cameras);
      return cameras;
    } catch {
      setVideoDevices([]);
      return [] as CameraDeviceOption[];
    }
  }, []);

  const waitForPreviewReady = useCallback((video: HTMLVideoElement | null, timeoutMs = 1400) => {
    return new Promise<boolean>((resolve) => {
      if (!video) {
        resolve(false);
        return;
      }

      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        resolve(true);
        return;
      }

      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timeoutId);
        clearInterval(pollId);
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('canplay', onReady);
        resolve(ok);
      };

      const onReady = () => {
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) finish(true);
      };

      const timeoutId = window.setTimeout(() => {
        finish(video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0);
      }, timeoutMs);

      const pollId = window.setInterval(() => {
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) finish(true);
      }, 120);

      video.addEventListener('loadeddata', onReady);
      video.addEventListener('canplay', onReady);
    });
  }, []);

  const attachStreamToVideo = useCallback(async (stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    (video as any).webkitPlaysInline = true;

    await video.play().catch(() => {
      // Ignore play race errors (notably on mobile browsers).
    });
  }, []);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const emitScan = useCallback((raw: string) => {
    const normalized = raw.trim();
    const now = Date.now();
    if (!normalized) return;
    if (normalized === lastEmitRef.current.value && now - lastEmitRef.current.at <= 850) return;
    lastEmitRef.current = { value: normalized, at: now };
    onScanRef.current(normalized);
  }, []);

  const detectLoop = useCallback(async () => {
    const video = videoRef.current;
    if (video && detectorRef.current && video.readyState >= 2) {
      try {
        const detected = await detectorRef.current.detect(video);
        const raw = detected?.find((item: any) => typeof item?.rawValue === 'string' && item.rawValue.trim())?.rawValue;
        if (typeof raw === 'string') emitScan(raw);
      } catch {
        // Ignore frame-level decode errors.
      }
    }

    frameRef.current = window.requestAnimationFrame(() => {
      void detectLoop();
    });
  }, [emitScan]);

  const findPreferredDeviceId = useCallback(
    async (desiredFacingMode: 'environment' | 'user', currentDeviceId?: string, currentDeviceLabel?: string) => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((device) => device.kind === 'videoinput');
        if (videoInputs.length < 2) return null;

        const preferredKeywords = desiredFacingMode === 'user'
          ? ['front', 'user', 'face', 'facetime', 'self']
          : ['back', 'rear', 'environment', 'world', 'outward'];
        const oppositeKeywords = desiredFacingMode === 'user'
          ? ['back', 'rear', 'environment', 'world', 'outward']
          : ['front', 'user', 'face', 'facetime', 'self'];

        const currentLooksVirtual = isLikelyVirtualCameraLabel(currentDeviceLabel || '');

        const scored = videoInputs.map((device) => {
          const label = (device.label || '').toLowerCase();
          const looksVirtual = isLikelyVirtualCameraLabel(label);
          let score = 0;
          if (preferredKeywords.some((keyword) => label.includes(keyword))) score += 5;
          if (oppositeKeywords.some((keyword) => label.includes(keyword))) score -= 4;
          if (looksVirtual) score -= 8;
          if (currentLooksVirtual && !looksVirtual) score += 2;
          if (currentDeviceId && device.deviceId === currentDeviceId) score -= 2;
          return { deviceId: device.deviceId, score };
        }).sort((a, b) => b.score - a.score);

        if (scored.length > 0 && scored[0].score > 0) return scored[0].deviceId;

        const nonVirtual = videoInputs.filter((device) => !isLikelyVirtualCameraLabel(device.label || ''));
        if (nonVirtual.length > 0) {
          if (currentDeviceId) {
            const nonCurrent = nonVirtual.find((device) => device.deviceId !== currentDeviceId);
            if (nonCurrent) return nonCurrent.deviceId;
          }
          return nonVirtual[0].deviceId;
        }

        if (currentDeviceId) {
          const fallback = videoInputs.find((device) => device.deviceId !== currentDeviceId);
          if (fallback) return fallback.deviceId;
        }

        return null;
      } catch {
        return null;
      }
    },
    [],
  );

  const startCamera = useCallback(async (requestedFacingMode?: 'environment' | 'user', requestedDeviceId?: string) => {
    if (openingRef.current) return;
    openingRef.current = true;
    setStarting(true);
    setError('');

    const requestId = ++openRequestRef.current;

    if (frameRef.current != null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    zxingControlsRef.current = null;

    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
      } catch {
        // Ignore pause errors.
      }
      video.srcObject = null;
    }

    setActive(false);

    const desiredFacingMode = requestedFacingMode ?? facingMode;
    const desiredDeviceId = requestedDeviceId || preferredDeviceId;
    let cameraWarning = '';

    const constraintsList: MediaStreamConstraints[] = [
      ...(desiredDeviceId ? [{ video: { deviceId: { exact: desiredDeviceId } }, audio: false }] : []),
      { video: { facingMode: { exact: desiredFacingMode } }, audio: false },
      { video: { facingMode: { ideal: desiredFacingMode } }, audio: false },
      { video: { facingMode: desiredFacingMode }, audio: false },
      { video: true, audio: false },
    ];

    try {
      let stream: MediaStream | null = null;
      let openError: any = null;

      for (const constraints of constraintsList) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (error: any) {
          openError = error;
        }
      }

      if (!stream) throw openError || new Error('No camera stream available');

      if (requestId !== openRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const initialTrack = stream.getVideoTracks()[0];
      const initialSettings = initialTrack?.getSettings?.();
      const initialDeviceId = typeof initialSettings?.deviceId === 'string' ? initialSettings.deviceId : '';
      const initialFacing = typeof initialSettings?.facingMode === 'string' ? initialSettings.facingMode.toLowerCase() : '';
      const initialLabel = (initialTrack?.label || '').toLowerCase();
      const initialLooksVirtual = isLikelyVirtualCameraLabel(initialLabel);

      const facingLooksWrong = initialFacing
        ? (desiredFacingMode === 'user'
          ? initialFacing.includes('environment') || initialFacing.includes('back') || initialFacing.includes('rear')
          : initialFacing.includes('user') || initialFacing.includes('front'))
        : false;

      if (initialLooksVirtual || facingLooksWrong || !initialFacing) {
        const preferredDeviceId = await findPreferredDeviceId(desiredFacingMode, initialDeviceId, initialLabel);
        if (preferredDeviceId && preferredDeviceId !== initialDeviceId) {
          stream.getTracks().forEach((track) => track.stop());
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: preferredDeviceId } },
            audio: false,
          });

          if (requestId !== openRequestRef.current) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
        }
      }

      await attachStreamToVideo(stream);

      const previewReadyInitially = await waitForPreviewReady(videoRef.current, 1200);
      if (!previewReadyInitially) {
        const cameraList = await refreshVideoDevices();
        const currentStreamTrack = stream.getVideoTracks()[0];
        const currentStreamDeviceId = currentStreamTrack?.getSettings?.().deviceId || '';
        const fallbackCandidates = cameraList
          .filter((camera) => camera.deviceId && camera.deviceId !== currentStreamDeviceId)
          .sort((a, b) => Number(a.isVirtual) - Number(b.isVirtual));

        for (const candidate of fallbackCandidates) {
          try {
            stream.getTracks().forEach((track) => track.stop());
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: candidate.deviceId } },
              audio: false,
            });

            if (requestId !== openRequestRef.current) {
              stream.getTracks().forEach((track) => track.stop());
              return;
            }

            await attachStreamToVideo(stream);

            const ready = await waitForPreviewReady(videoRef.current, 900);
            if (ready) break;
          } catch {
            // Try next fallback camera.
          }
        }
      }

      streamRef.current = stream;
      await attachStreamToVideo(stream);

      if (requestId !== openRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const finalTrack = stream.getVideoTracks()[0];
      const finalSettings = finalTrack?.getSettings?.();
      const finalDeviceId = typeof finalSettings?.deviceId === 'string' ? finalSettings.deviceId : '';
      setActiveDeviceId(finalDeviceId || '');
      await refreshVideoDevices();

      const previewReady = await waitForPreviewReady(videoRef.current, 900);
      if (!previewReady) {
        cameraWarning = 'Camera connected but preview is black. Select another camera source.';
      }

      const finalLabel = (finalTrack?.label || '').toLowerCase();
      if (isLikelyVirtualCameraLabel(finalLabel)) {
        cameraWarning = cameraWarning || 'Virtual camera is selected. If preview is black, switch to a physical webcam or start virtual output in OBS.';
      }

      setActive(true);

      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      if (BarcodeDetectorCtor) {
        detectorRef.current = new BarcodeDetectorCtor({
          formats: ['qr_code', 'code_128', 'code_39', 'code_93', 'codabar', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'],
        });

        setError(cameraWarning);

        if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
        frameRef.current = window.requestAnimationFrame(() => {
          void detectLoop();
        });
        return;
      }

      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();

        const controls = await reader.decodeFromStream(
          stream,
          videoRef.current || undefined,
          (result) => {
            if (requestId !== openRequestRef.current) return;
            const text = result?.getText?.();
            if (typeof text === 'string' && text.trim()) emitScan(text);
          },
        );

        if (requestId !== openRequestRef.current) {
          controls.stop();
          return;
        }

        zxingControlsRef.current = controls;
        setError(cameraWarning);
      } catch {
        setError(cameraWarning || 'Camera opened. Auto decode fallback is not available here. Use scanner input line.');
      }
    } catch (error: any) {
      if (requestId !== openRequestRef.current) return;
      const detail = error?.message ? ` (${error.message})` : '';
      stopCamera();
      setError(`Could not open camera. Please allow camera access${detail}`);
    } finally {
      if (requestId === openRequestRef.current) {
        openingRef.current = false;
        setStarting(false);
      }
    }
  }, [attachStreamToVideo, detectLoop, emitScan, facingMode, findPreferredDeviceId, preferredDeviceId, refreshVideoDevices, stopCamera, waitForPreviewReady]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      if (event.key === 'Enter') {
        const value = keyboardBufferRef.current.trim();
        if (value.length >= 3) onScan(value);
        keyboardBufferRef.current = '';
        return;
      }

      if (event.key.length === 1) {
        keyboardBufferRef.current += event.key;
        if (keyboardTimerRef.current) clearTimeout(keyboardTimerRef.current);
        keyboardTimerRef.current = setTimeout(() => {
          keyboardBufferRef.current = '';
        }, 230);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (keyboardTimerRef.current) clearTimeout(keyboardTimerRef.current);
    };
  }, [onScan]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (keyboardTimerRef.current) clearTimeout(keyboardTimerRef.current);
    };
  }, [stopCamera]);

  useEffect(() => {
    void refreshVideoDevices();
  }, [refreshVideoDevices]);

  return { videoRef, active, starting, error, startCamera, stopCamera, videoDevices, activeDeviceId };
}

export default function AdminMarkAttendance() {
  const { instituteId } = useParams<{ instituteId: string }>();
  const [searchParams] = useSearchParams();
  const requestedClassId = (searchParams.get('classId') || '').trim();
  const requestedMode = (searchParams.get('mode') || '').trim().toLowerCase();
  const requestedDate = (() => {
    const value = (searchParams.get('date') || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  })();
  const requestedSessionTime = (() => {
    const value = (searchParams.get('sessionTime') || '').trim();
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? value : '';
  })();
  const requestedSessionCode = (searchParams.get('sessionCode') || '').trim();
  const requestedSessionSummary = [
    requestedDate || '',
    requestedSessionTime || '',
    requestedSessionCode ? `Code: ${requestedSessionCode}` : '',
  ].filter(Boolean).join(' | ');

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(requestedDate || toDateStr(new Date()));
  const [status, setStatus] = useState<AttStatus>('PRESENT');
  const [entryMode, setEntryMode] = useState<'simple' | 'advanced'>(
    requestedMode === 'advanced' ? 'advanced' : 'simple',
  );
  const [sessionTime, setSessionTime] = useState(requestedSessionTime || toTimeStr(new Date()));
  const [sessionCode, setSessionCode] = useState(requestedSessionCode);
  const [sessionMessage, setSessionMessage] = useState(
    requestedSessionSummary ? `Selected session: ${requestedSessionSummary}` : '',
  );
  const [closingSession, setClosingSession] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [phase, setPhase] = useState<'ready' | 'waiting' | 'success' | 'error'>('ready');
  const [message, setMessage] = useState('Ready to scan');
  const [resultPopup, setResultPopup] = useState<ScanResultPopup | null>(null);
  const [recent, setRecent] = useState<ScanLogItem[]>([]);
  const [classStudents, setClassStudents] = useState<ClassStudentItem[]>([]);
  const [studentsById, setStudentsById] = useState<Record<string, ClassStudentItem>>({});
  const [studentFilter, setStudentFilter] = useState('');
  const [lastMarkedId, setLastMarkedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>(
    () => readStoredFacingMode() || getDefaultFacingMode(),
  );
  const [cameraDeviceId, setCameraDeviceId] = useState<string>(() => readStoredCameraDeviceId());
  const [isCameraFullscreen, setIsCameraFullscreen] = useState(false);
  const [popupImageLoadFailed, setPopupImageLoadFailed] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const cameraShellRef = useRef<HTMLDivElement>(null);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStartRef = useRef(false);
  const scanGateRef = useRef(false);
  const barcodeRouteModeRef = useRef<'auto' | 'by-barcode' | 'legacy'>(readStoredBarcodeRouteMode());
  const apiUnavailableRef = useRef(false);
  const failedScanCooldownRef = useRef<{ id: string; at: number }>({ id: '', at: 0 });

  const normalizedSessionTime = useMemo(() => sessionTime || '00:00', [sessionTime]);
  const trimmedSessionCode = useMemo(() => sessionCode.trim(), [sessionCode]);

  const lastMarkedStorageKey = useMemo(
    () => (
      selectedClassId
        ? `mark-attendance:last:${selectedClassId}:${selectedDate}:${normalizedSessionTime}`
        : ''
    ),
    [selectedClassId, selectedDate, normalizedSessionTime],
  );

  const getEffectiveSessionCode = useCallback(() => {
    if (trimmedSessionCode) return trimmedSessionCode;
    return `S-${selectedDate}-${normalizedSessionTime.replace(':', '')}`;
  }, [normalizedSessionTime, selectedDate, trimmedSessionCode]);

  const handleCreateSession = useCallback(() => {
    const code = getEffectiveSessionCode();
    if (!trimmedSessionCode) {
      setSessionCode(code);
    }
    setSessionMessage(`Session ready: ${code} (${selectedDate} ${normalizedSessionTime})`);
  }, [getEffectiveSessionCode, normalizedSessionTime, selectedDate, trimmedSessionCode]);

  const handleCloseSession = useCallback(async () => {
    if (!selectedClassId) return;
    setClosingSession(true);
    setSessionMessage('');

    try {
      const code = getEffectiveSessionCode();
      const response = await api.post(`/attendance/class-attendance/class/${selectedClassId}/close-session`, {
        date: selectedDate,
        sessionTime: normalizedSessionTime,
        sessionCode: code || undefined,
      });
      const marked = Number(response?.data?.marked || 0);
      setSessionMessage(`Session closed (${code}) - ${marked} absent student${marked === 1 ? '' : 's'} auto-marked.`);
    } catch (error: any) {
      setSessionMessage(error?.response?.data?.message || 'Failed to close session.');
    } finally {
      setClosingSession(false);
    }
  }, [getEffectiveSessionCode, normalizedSessionTime, selectedClassId, selectedDate]);

  const submitScan = useCallback(async (rawValue: string) => {
    const identifier = normalizeScannedIdentifier(rawValue);
    if (!identifier || !selectedClassId) return;
    const matchedStudentByScan = findStudentByIdentifier(identifier, classStudents);

    setScanInput(identifier);

    if (phase !== 'ready' || scanGateRef.current) return;

    if (apiUnavailableRef.current) {
      scanGateRef.current = true;
      setPhase('error');
      setMessage('Class attendance API not available on this backend');
      setResultPopup({
        status: 'error',
        name: 'Backend Not Updated',
        identifier,
        message: 'Class attendance API is not available on this server deployment.',
      });

      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
      loopTimerRef.current = setTimeout(() => {
        setResultPopup(null);
        setScanInput('');
        setPhase('ready');
        setMessage('Ready to scan next student');
        scanGateRef.current = false;
      }, 2000);
      return;
    }

    const now = Date.now();
    if (failedScanCooldownRef.current.id === identifier && now - failedScanCooldownRef.current.at < 8000) {
      return;
    }

    if (identifier === lastMarkedId) {
      scanGateRef.current = true;
      setPhase('error');
      setMessage(`Duplicate ignored: ${identifier}`);
      setResultPopup({
        status: 'error',
        name: 'Duplicate Scan',
        identifier,
        message: `Duplicate ignored: ${identifier}`,
      });

      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
      loopTimerRef.current = setTimeout(() => {
        setResultPopup(null);
        setScanInput('');
        setPhase('ready');
        setMessage('Ready to scan next student');
        scanGateRef.current = false;
      }, 2000);
      return;
    }

    scanGateRef.current = true;
    setPhase('waiting');
    setMessage('Submitting attendance...');
    setResultPopup(null);

    try {
      const markViaBarcodeRoute = async () => {
        const response = await api.post('/attendance/class-attendance/mark/by-barcode', {
          classId: selectedClassId,
          barcode: identifier,
          date: selectedDate,
          status,
          sessionTime: normalizedSessionTime,
          sessionCode: getEffectiveSessionCode() || undefined,
        });
        return response.data;
      };

      const markViaLegacyRoute = async () => {
        const response = await api.post('/attendance/class-attendance/mark', {
          classId: selectedClassId,
          identifier,
          date: selectedDate,
          status,
          sessionTime: normalizedSessionTime,
          sessionCode: getEffectiveSessionCode() || undefined,
          method: 'barcode',
        });
        return response.data;
      };

      let data: any;
      if (barcodeRouteModeRef.current === 'legacy') {
        try {
          data = await markViaLegacyRoute();
        } catch (legacyError: any) {
          if (isMissingRoute404(legacyError, 'class-attendance/mark')) {
            apiUnavailableRef.current = true;
            throw new Error('Class attendance API is not available on this server deployment.');
          }
          throw legacyError;
        }
      } else {
        try {
          data = await markViaBarcodeRoute();
          barcodeRouteModeRef.current = 'by-barcode';
          localStorage.setItem(BARCODE_ROUTE_MODE_STORAGE_KEY, 'by-barcode');
        } catch (error: any) {
          if (!isMissingRoute404(error, 'class-attendance/mark/by-barcode')) throw error;

          try {
            data = await markViaLegacyRoute();
            barcodeRouteModeRef.current = 'legacy';
            localStorage.setItem(BARCODE_ROUTE_MODE_STORAGE_KEY, 'legacy');
          } catch (legacyError: any) {
            if (isMissingRoute404(legacyError, 'class-attendance/mark')) {
              apiUnavailableRef.current = true;
              throw new Error('Class attendance API is not available on this server deployment.');
            }
            throw legacyError;
          }
        }
      }

      const studentMeta = (data?.userId ? studentsById[data.userId] : undefined) || matchedStudentByScan;
      const profile = data?.user?.profile;
      const name = profile?.fullName || studentMeta?.fullName || identifier;
      const avatarUrl = profile?.avatarUrl || studentMeta?.avatarUrl || '';
      const instituteUserId = studentMeta?.instituteId || profile?.instituteId || '';
      const barcodeId = studentMeta?.barcodeId || profile?.barcodeId || '';

      setLastMarkedId(identifier);
      setResultPopup({
        status: 'success',
        userId: data?.userId || studentMeta?.userId || matchedStudentByScan?.userId || '',
        name,
        identifier,
        instituteId: instituteUserId,
        barcodeId,
        avatarUrl,
        sessionTime: data?.sessionTime || normalizedSessionTime,
        sessionCode: data?.sessionCode || getEffectiveSessionCode() || '',
      });
      setRecent((prev) => [
        {
          id: identifier,
          name,
          time: new Date().toLocaleTimeString('en-GB'),
          ok: true,
        },
        ...prev.slice(0, 24),
      ]);
      setPhase('success');
      setMessage('Attendance marked. Preparing for next scan...');
      failedScanCooldownRef.current = { id: '', at: 0 };

      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
      loopTimerRef.current = setTimeout(() => {
        setResultPopup(null);
        setScanInput('');
        setPhase('ready');
        setMessage('Ready to scan next student');
        scanGateRef.current = false;
      }, 2000);
    } catch (error: any) {
      const errMsg = extractApiErrorMessage(error) || 'Student not found';
      setPhase('error');
      setMessage(errMsg);
      failedScanCooldownRef.current = { id: identifier, at: Date.now() };
      setResultPopup({
        status: 'error',
        name: 'Mark Failed',
        identifier,
        message: errMsg,
      });
      setRecent((prev) => [
        {
          id: identifier,
          name: 'Unknown',
          time: new Date().toLocaleTimeString('en-GB'),
          ok: false,
          message: errMsg,
        },
        ...prev.slice(0, 24),
      ]);

      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
      loopTimerRef.current = setTimeout(() => {
        setResultPopup(null);
        setScanInput('');
        setPhase('ready');
        setMessage('Ready to scan next student');
        scanGateRef.current = false;
      }, 2000);
    }
  }, [
    classStudents,
    getEffectiveSessionCode,
    lastMarkedId,
    normalizedSessionTime,
    phase,
    selectedClassId,
    selectedDate,
    status,
    studentsById,
  ]);

  const {
    videoRef,
    active: cameraActive,
    starting: cameraStarting,
    error: cameraError,
    startCamera,
    stopCamera,
    videoDevices,
    activeDeviceId,
  } = useCameraScanner((code) => {
    void submitScan(code);
  }, cameraFacingMode, cameraDeviceId);

  useEffect(() => {
    const loadClasses = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/classes');
        const classRows = (data || []) as ClassItem[];
        setClasses(classRows);
        if (classRows.length > 0) {
          const hasRequestedClass = requestedClassId && classRows.some((row) => row.id === requestedClassId);
          setSelectedClassId(hasRequestedClass ? requestedClassId : classRows[0].id);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadClasses();
  }, [requestedClassId]);

  useEffect(() => {
    if (!selectedClassId) {
      setClassStudents([]);
      setStudentsById({});
      return;
    }

    api.get(`/attendance/class-attendance/class/${selectedClassId}/students`)
      .then((response) => {
        const payload = response.data as unknown;
        const rows = Array.isArray(payload)
          ? payload
          : payload && typeof payload === 'object' && Array.isArray((payload as { students?: unknown[] }).students)
            ? (payload as { students: unknown[] }).students
            : [];
        const normalizedRows = rows
          .map((item) => normalizeClassStudentItem(item))
          .filter((item): item is ClassStudentItem => Boolean(item));
        const index: Record<string, ClassStudentItem> = {};
        normalizedRows.forEach((item) => {
          if (item?.userId) index[item.userId] = item;
        });
        setClassStudents(normalizedRows);
        setStudentsById(index);
      })
      .catch(() => {
        setClassStudents([]);
        setStudentsById({});
      });
  }, [selectedClassId]);

  useEffect(() => {
    if (!lastMarkedStorageKey) {
      setLastMarkedId('');
      return;
    }
    setLastMarkedId(localStorage.getItem(lastMarkedStorageKey) || '');
  }, [lastMarkedStorageKey]);

  useEffect(() => {
    if (!lastMarkedStorageKey) return;
    if (lastMarkedId) localStorage.setItem(lastMarkedStorageKey, lastMarkedId);
    else localStorage.removeItem(lastMarkedStorageKey);
  }, [lastMarkedStorageKey, lastMarkedId]);

  useEffect(() => {
    localStorage.setItem(CAMERA_FACING_MODE_STORAGE_KEY, cameraFacingMode);
  }, [cameraFacingMode]);

  useEffect(() => {
    if (cameraDeviceId) localStorage.setItem(CAMERA_DEVICE_ID_STORAGE_KEY, cameraDeviceId);
    else localStorage.removeItem(CAMERA_DEVICE_ID_STORAGE_KEY);
  }, [cameraDeviceId]);

  useEffect(() => {
    if (activeDeviceId && activeDeviceId !== cameraDeviceId) {
      setCameraDeviceId(activeDeviceId);
    }
  }, [activeDeviceId, cameraDeviceId]);

  useEffect(() => {
    if (loading || !selectedClassId || autoStartRef.current) return;
    autoStartRef.current = true;
    void startCamera(undefined, cameraDeviceId || undefined);
  }, [cameraDeviceId, loading, selectedClassId, startCamera]);

  useEffect(() => {
    return () => {
      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsCameraFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  const toggleCameraFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (cameraShellRef.current) {
        await cameraShellRef.current.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen errors.
    }
  }, []);

  const handleManualSubmit = useCallback(async () => {
    if (!scanInput.trim()) return;
    await submitScan(scanInput);
  }, [scanInput, submitScan]);

  const adminBase = getInstituteAdminPath(instituteId);
  const attendanceNavigationQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedClassId) params.set('classId', selectedClassId);
    if (selectedDate) params.set('date', selectedDate);
    if (normalizedSessionTime) params.set('sessionTime', normalizedSessionTime);
    if (trimmedSessionCode) params.set('sessionCode', trimmedSessionCode);
    return params.toString();
  }, [normalizedSessionTime, selectedClassId, selectedDate, trimmedSessionCode]);
  const externalDevicePath = attendanceNavigationQuery
    ? getInstituteAdminPath(instituteId, `/mark-attendance/external-device?${attendanceNavigationQuery}`)
    : getInstituteAdminPath(instituteId, '/mark-attendance/external-device');
  const classAttendancePath = attendanceNavigationQuery
    ? getInstituteAdminPath(instituteId, `/class-attendance?${attendanceNavigationQuery}`)
    : getInstituteAdminPath(instituteId, '/class-attendance');
  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const showAdvancedFields = entryMode === 'advanced';
  const popupAvatarUrl = resolveAvatarUrl(resultPopup?.avatarUrl);
  const filteredStudents = useMemo(() => {
    const query = studentFilter.trim().toLowerCase();
    if (!query) return classStudents;
    return classStudents.filter((student) => {
      const fields = [
        student.fullName,
        student.instituteId,
        student.barcodeId || '',
        student.userId,
      ];
      return fields.some((field) => field.toLowerCase().includes(query));
    });
  }, [classStudents, studentFilter]);

  useEffect(() => {
    setPopupImageLoadFailed(false);
  }, [resultPopup?.identifier, resultPopup?.avatarUrl]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="w-full">
        <div className="px-3 md:px-4 py-3 border-b border-white/10 bg-[#0b1118] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={adminBase}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/20 text-slate-200 hover:text-white"
            >
              Close
            </Link>
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-bold truncate">Mark Attendance</h1>
              <p className="text-xs text-slate-300 truncate">Camera scanner entry page</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link
              to={classAttendancePath}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
            >
              View Attendance
            </Link>
            <Link
              to={externalDevicePath}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-300/40 bg-indigo-500/10 text-indigo-100"
            >
              External Device
            </Link>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold border border-blue-300/40 bg-blue-500/20 text-blue-100">
              {recent.filter((item) => item.ok).length}
            </span>
          </div>
        </div>

        <div className="px-3 md:px-4 py-3 space-y-3 bg-[#0f1720] border-b border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Scan Setup</p>
            <div className="inline-flex overflow-hidden rounded-lg border border-white/20 bg-[#131f2c]">
              <button
                onClick={() => {
                  setEntryMode('simple');
                }}
                className={`px-2.5 py-1.5 text-xs font-semibold transition ${
                  !showAdvancedFields ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Simple
              </button>
              <button
                onClick={() => setEntryMode('advanced')}
                className={`px-2.5 py-1.5 text-xs font-semibold transition ${
                  showAdvancedFields ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Advanced
              </button>
            </div>
          </div>

          <div className={`grid gap-2 ${showAdvancedFields ? 'md:grid-cols-[1fr_165px_170px_170px]' : 'md:grid-cols-[1fr_165px_170px]'}`}>
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="px-3 py-2.5 rounded-xl border border-white/20 bg-[#131f2c] text-sm text-slate-100"
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}{item.subject ? ` - ${item.subject}` : ''}</option>
              ))}
            </select>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="px-3 py-2.5 rounded-xl border border-white/20 bg-[#131f2c] text-sm text-slate-100"
            />
            {showAdvancedFields && (
              <input
                type="time"
                value={sessionTime}
                onChange={(event) => setSessionTime(event.target.value)}
                className="px-3 py-2.5 rounded-xl border border-white/20 bg-[#131f2c] text-sm text-slate-100"
              />
            )}
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as AttStatus)}
              className="px-3 py-2.5 rounded-xl border border-white/20 bg-[#131f2c] text-sm text-slate-100"
            >
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="ABSENT">Absent</option>
              <option value="EXCUSED">Excused</option>
            </select>
          </div>

          {showAdvancedFields ? (
            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <input
                type="text"
                value={sessionCode}
                onChange={(event) => setSessionCode(event.target.value)}
                placeholder="Session code (optional) e.g. WEEK-01"
                className="px-3 py-2.5 rounded-xl border border-white/20 bg-[#131f2c] text-sm text-slate-100"
              />
              <button
                type="button"
                onClick={() => handleCreateSession()}
                className="px-3 py-2.5 rounded-xl border border-blue-300/40 bg-blue-500/10 text-xs font-semibold text-blue-100 hover:bg-blue-500/20"
              >
                Create Session
              </button>
              <button
                type="button"
                onClick={() => void handleCloseSession()}
                disabled={closingSession || !selectedClassId}
                className="px-3 py-2.5 rounded-xl border border-emerald-300/40 bg-emerald-500/10 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {closingSession ? 'Closing...' : 'Close Session'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-300">
              Session time is <span className="font-semibold text-white">{normalizedSessionTime}</span>.
              {' '}Switch to Advanced to set custom session code and manage closing.
            </p>
          )}

          {sessionMessage && (
            <p className="text-xs text-emerald-200">{sessionMessage}</p>
          )}
        </div>

        <div
          ref={cameraShellRef}
          className={`relative bg-black overflow-hidden ${isCameraFullscreen ? 'h-screen' : 'h-[62vh] md:h-[72vh]'}`}
        >
          <video
            ref={videoRef}
            className={`w-full h-full object-cover transition-opacity duration-200 ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
            muted
            playsInline
            autoPlay
          />

          {!cameraActive && (
            <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm">
              {cameraStarting ? 'Opening camera...' : 'Camera is stopped. Click Open Camera.'}
            </div>
          )}

          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-72 h-72 max-w-[84%] max-h-[84%] rounded-2xl border-2 border-blue-500/95 shadow-[0_0_24px_rgba(59,130,246,0.42)] relative overflow-hidden">
                <div className="absolute left-4 right-4 top-1/2 h-[2px] bg-blue-400/95" />
              </div>
            </div>
          )}

          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
            <div className="px-2.5 py-1 rounded-lg bg-black/45 border border-white/20 text-xs font-semibold text-slate-100">
              {selectedClass ? selectedClass.name : 'Select class'}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (cameraActive) stopCamera();
                  else void startCamera(undefined, cameraDeviceId || undefined);
                }}
                disabled={cameraStarting}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${cameraActive ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'} disabled:opacity-65 disabled:cursor-not-allowed`}
              >
                {cameraStarting ? 'Opening...' : cameraActive ? 'Stop' : 'Open Camera'}
              </button>
              <select
                value={cameraDeviceId || activeDeviceId || ''}
                onChange={(event) => {
                  const nextDeviceId = event.target.value;
                  setCameraDeviceId(nextDeviceId);
                  if (cameraActive) {
                    void startCamera(undefined, nextDeviceId || undefined);
                  }
                }}
                disabled={cameraStarting || videoDevices.length === 0}
                className="max-w-[210px] px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-black/45 border border-white/20 text-slate-100 disabled:opacity-60"
              >
                {videoDevices.length === 0 ? (
                  <option value="">No camera list</option>
                ) : (
                  videoDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))
                )}
              </select>
              <button
                onClick={() => {
                  const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
                  setCameraFacingMode(nextMode);
                  if (cameraActive) {
                    void startCamera(nextMode, cameraDeviceId || undefined);
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/45 border border-white/20 text-slate-100"
              >
                {cameraFacingMode === 'environment' ? 'Self Mode' : 'Back Mode'}
              </button>
              <button
                onClick={() => void toggleCameraFullscreen()}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/45 border border-white/20 text-slate-100"
              >
                {isCameraFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
            </div>
          </div>

        </div>

        <div className="px-3 md:px-4 py-3 bg-[hsl(var(--background))] text-[hsl(var(--foreground))] space-y-3 border-t border-[hsl(var(--border))]">
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <div>
              <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Barcode ID</label>
              <input
                ref={scanInputRef}
                type="text"
                value={scanInput}
                onChange={(event) => setScanInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void handleManualSubmit()}
                placeholder="Scan or type Barcode ID"
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm"
              />
            </div>
            <button
              onClick={() => void handleManualSubmit()}
              disabled={!scanInput.trim() || phase === 'waiting'}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 self-end"
            >
              {phase === 'waiting' ? 'Submitting...' : 'Submit'}
            </button>
          </div>

          <div className={`px-3 py-2 rounded-xl border text-xs font-semibold ${
            phase === 'waiting' ? 'bg-amber-50 border-amber-200 text-amber-700' :
            phase === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
            phase === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
            'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            {message}
          </div>

          {cameraError && <p className="text-xs text-red-600">{cameraError}</p>}

          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">Recent scans</p>
            {recent.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No scans yet</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {recent.slice(0, 10).map((item, index) => (
                  <div key={`${item.id}-${item.time}-${index}`} className="flex items-center gap-2 text-xs">
                    <span className={item.ok ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>{item.ok ? '✓' : '✕'}</span>
                    <span className="font-medium text-[hsl(var(--foreground))] truncate">{item.name}</span>
                    <span className="font-mono text-[hsl(var(--muted-foreground))] truncate">{item.id}</span>
                    <span className="ml-auto shrink-0 text-[hsl(var(--muted-foreground))]">{item.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Class Students ({filteredStudents.length}/{classStudents.length})
              </p>
              <input
                type="text"
                value={studentFilter}
                onChange={(event) => setStudentFilter(event.target.value)}
                placeholder="Filter by name, institute ID, barcode ID, or user ID"
                className="w-full md:w-80 px-3 py-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-xs"
              />
            </div>

            {classStudents.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No linked students found for this class.</p>
            ) : filteredStudents.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No students match this filter.</p>
            ) : (
              <div className="max-h-64 overflow-auto rounded-xl border border-[hsl(var(--border))]">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Student Name</th>
                      <th className="px-3 py-2 text-left font-semibold">Institute User ID</th>
                      <th className="px-3 py-2 text-left font-semibold">Barcode ID</th>
                      <th className="px-3 py-2 text-left font-semibold">User ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.userId} className="border-t border-[hsl(var(--border))]">
                        <td className="px-3 py-2 font-medium text-[hsl(var(--foreground))]">{student.fullName || '-'}</td>
                        <td className="px-3 py-2 font-mono text-[hsl(var(--foreground))]">{student.instituteId || '-'}</td>
                        <td className="px-3 py-2 font-mono text-[hsl(var(--foreground))]">{student.barcodeId || '-'}</td>
                        <td className="px-3 py-2 font-mono text-[hsl(var(--muted-foreground))]">{student.userId || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {resultPopup && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center px-4">
          <div className={`w-[min(95vw,620px)] rounded-3xl border px-5 md:px-6 py-5 shadow-2xl ${
            resultPopup.status === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}>
            <div className="flex items-center gap-4">
              {popupAvatarUrl && !popupImageLoadFailed ? (
                <img
                  src={popupAvatarUrl}
                  alt={resultPopup.name}
                  onError={() => setPopupImageLoadFailed(true)}
                  className="w-20 h-20 rounded-full object-cover shrink-0 ring-2 ring-white/55"
                />
              ) : (
                <div className={`w-20 h-20 rounded-2xl text-2xl font-bold flex items-center justify-center shrink-0 ${
                  resultPopup.status === 'success' ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'
                }`}>
                  {(resultPopup.name || '?')[0]?.toUpperCase() || '?'}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xl md:text-2xl font-extrabold truncate">{resultPopup.name}</p>
                <p className="text-sm font-mono font-semibold truncate">{resultPopup.identifier}</p>

                {resultPopup.status === 'success' ? (
                  <div className="mt-1.5 text-xs md:text-sm space-y-0.5">
                    <p className="truncate">Institute ID: <span className="font-mono">{resultPopup.instituteId || '-'}</span></p>
                    <p className="truncate">Barcode ID: <span className="font-mono">{resultPopup.barcodeId || '-'}</span></p>
                    <p className="truncate">User ID: <span className="font-mono">{resultPopup.userId || '-'}</span></p>
                    <p className="truncate">Session Time: <span className="font-mono">{resultPopup.sessionTime || '-'}</span></p>
                    {resultPopup.sessionCode && (
                      <p className="truncate">Session Code: <span className="font-mono">{resultPopup.sessionCode}</span></p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1.5 text-sm font-semibold truncate">{resultPopup.message || 'Failed to mark attendance'}</p>
                )}
              </div>

              <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-3xl md:text-4xl font-black shrink-0 ${
                resultPopup.status === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
              }`}>
                {resultPopup.status === 'success' ? '✓' : 'X'}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  );
}
