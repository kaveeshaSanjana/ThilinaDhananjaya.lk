# Student — Month Recording Attendance API

Get the authenticated student's attendance across **all recordings in a class month** in a single request.

---

## Endpoint

```
GET /attendance/my/month/:monthId
```

**Auth:** JWT (student)  
**Param:** `monthId` — the ID of the class month

---

## Response shape

```json
{
  "month": {
    "id": "string",
    "name": "string",
    "year": "number",
    "month": "number",
    "class": {
      "id": "string",
      "name": "string",
      "subject": "string | null"
    }
  },
  "recordings": [
    {
      "id": "string",
      "title": "string",
      "duration": "number | null",
      "thumbnail": "string | null",
      "topic": "string | null",
      "isLive": "boolean",
      "order": "number",
      "videoType": "DRIVE | YOUTUBE | ZOOM | OTHER | null",
      "status": "ANYONE | STUDENTS_ONLY | PAID_ONLY | PRIVATE",
      "attendance": {
        "status": "COMPLETED | INCOMPLETE | MANUAL",
        "watchedSec": "number",
        "liveJoinedAt": "string (ISO) | null",
        "completedAt": "string (ISO) | null",
        "details": "any[]"
      },
      "sessionCount": "number",
      "totalWatchedSec": "number",
      "lastWatchedAt": "string (ISO) | null",
      "sessions": [
        {
          "startedAt": "string (ISO)",
          "endedAt": "string (ISO) | null",
          "videoStartPos": "number",
          "videoEndPos": "number",
          "totalWatchedSec": "number",
          "status": "WATCHING | PAUSED | ENDED"
        }
      ]
    }
  ],
  "summary": {
    "total": "number",
    "completed": "number",
    "incomplete": "number",
    "notWatched": "number"
  }
}
```

> `recordings` is sorted by `order` ascending. `INACTIVE` recordings are excluded.  
> `attendance` is `null` if the student has never opened that recording.  
> `totalWatchedSec` is the sum across all watch sessions — may exceed `duration` due to replays.  
> `sessions` are sorted newest first.

---

## Example request

```http
GET /attendance/my/month/abc123-month-id
Authorization: Bearer <student_token>
```

---

## Example response

```json
{
  "month": {
    "id": "abc123",
    "name": "January 2026",
    "year": 2026,
    "month": 1,
    "class": { "id": "cls001", "name": "Physics Grade 12", "subject": "Physics" }
  },
  "recordings": [
    {
      "id": "rec001",
      "title": "Lesson 01 - Newton's Laws",
      "duration": 3600,
      "thumbnail": "https://cdn.example.com/thumb1.jpg",
      "topic": "Mechanics",
      "isLive": false,
      "order": 1,
      "videoType": "YOUTUBE",
      "status": "PAID_ONLY",
      "attendance": {
        "status": "COMPLETED",
        "watchedSec": 3200,
        "liveJoinedAt": null,
        "completedAt": "2026-01-10T08:45:00.000Z",
        "details": []
      },
      "sessionCount": 2,
      "totalWatchedSec": 3400,
      "lastWatchedAt": "2026-01-10T08:30:00.000Z",
      "sessions": [
        {
          "startedAt": "2026-01-10T08:30:00.000Z",
          "endedAt": "2026-01-10T08:45:00.000Z",
          "videoStartPos": 0,
          "videoEndPos": 900,
          "totalWatchedSec": 900,
          "status": "ENDED"
        }
      ]
    },
    {
      "id": "rec002",
      "title": "Lesson 02 - Friction",
      "duration": 2800,
      "thumbnail": null,
      "topic": null,
      "isLive": false,
      "order": 2,
      "videoType": "DRIVE",
      "status": "PAID_ONLY",
      "attendance": null,
      "sessionCount": 0,
      "totalWatchedSec": 0,
      "lastWatchedAt": null,
      "sessions": []
    }
  ],
  "summary": {
    "total": 2,
    "completed": 1,
    "incomplete": 0,
    "notWatched": 1
  }
}
```

---

## Frontend usage notes

### Progress bar per recording

```ts
function watchProgress(rec: RecordingRow): number {
  if (!rec.duration || rec.duration === 0) return 0;
  return Math.min(100, Math.round((rec.totalWatchedSec / rec.duration) * 100));
}
```

### Status badge

```ts
function statusBadge(rec: RecordingRow): string {
  const s = rec.attendance?.status;
  if (s === 'COMPLETED') return '✅ Completed';
  if (s === 'INCOMPLETE') return '⏳ In Progress';
  if (s === 'MANUAL') return '🖊 Manual';
  if (rec.sessionCount > 0) return '👁 Viewed';
  return '— Not watched';
}
```

### Month summary bar

```ts
const { total, completed, incomplete, notWatched } = response.summary;
const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
// e.g. "3 / 5 completed (60%)"
```

---

## TypeScript types

```ts
export interface StudentMonthAttendanceResponse {
  month: {
    id: string;
    name: string;
    year: number;
    month: number;
    class: { id: string; name: string; subject: string | null };
  };
  recordings: StudentMonthRecordingRow[];
  summary: {
    total: number;
    completed: number;
    incomplete: number;
    notWatched: number;
  };
}

export interface StudentMonthRecordingRow {
  id: string;
  title: string;
  duration: number | null;
  thumbnail: string | null;
  topic: string | null;
  isLive: boolean;
  order: number;
  videoType: 'DRIVE' | 'YOUTUBE' | 'ZOOM' | 'OTHER' | null;
  status: 'ANYONE' | 'STUDENTS_ONLY' | 'PAID_ONLY' | 'PRIVATE';
  attendance: {
    status: 'COMPLETED' | 'INCOMPLETE' | 'MANUAL';
    watchedSec: number;
    liveJoinedAt: string | null;
    completedAt: string | null;
    details: unknown[];
  } | null;
  sessionCount: number;
  totalWatchedSec: number;
  lastWatchedAt: string | null;
  sessions: {
    startedAt: string;
    endedAt: string | null;
    videoStartPos: number;
    videoEndPos: number;
    totalWatchedSec: number;
    status: 'WATCHING' | 'PAUSED' | 'ENDED';
  }[];
}
```

---

## Error responses

| Status | Reason |
|--------|--------|
| `401 Unauthorized` | Missing or invalid JWT |
| `404 Not Found` | `monthId` does not exist |
