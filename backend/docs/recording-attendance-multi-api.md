# Recording Attendance — Multi-Recording API

Two endpoints for querying attendance across any number of selected recordings at once.

---

## 1. Student — My Attendance for Selected Recordings

**Endpoint**
```
GET /attendance/my/recordings?ids=<id1>,<id2>,<id3>
```

**Auth:** JWT (student)  
**Query param:** `ids` — comma-separated recording IDs (one or more)

### Response shape

```json
{
  "user": {
    "id": "string",
    "email": "string",
    "profile": {
      "fullName": "string",
      "instituteId": "string",
      "avatarUrl": "string | null",
      "phone": "string | null",
      "status": "ACTIVE | INACTIVE | PENDING | OLD"
    }
  },
  "months": [
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
              "status": "WATCHING | PAUSED | ENDED",
              "events": "any[]"
            }
          ]
        }
      ]
    }
  ]
}
```

> `attendance` is `null` if the student has never opened that recording.  
> `months` is sorted by year then month ascending.  
> Within each month, `recordings` are sorted by `order` ascending.

### Example request

```http
GET /attendance/my/recordings?ids=abc123,def456
Authorization: Bearer <student_token>
```

### Frontend usage notes

- Use this to show a student their own progress across a hand-picked set of recordings (e.g. a comparison view or a study tracker).
- To show a "watched / not watched" badge, check `attendance?.status === 'COMPLETED'`.
- To show a progress bar, compute `(attendance.watchedSec / duration) * 100`.
- `totalWatchedSec` is the sum across all watch sessions (may exceed `duration` due to replays).

---

## 2. Admin — All Students' Attendance for Selected Recordings

**Endpoint**
```
GET /attendance/recordings/users?ids=<id1>,<id2>,<id3>
```

**Auth:** JWT (admin only)  
**Query param:** `ids` — comma-separated recording IDs (one or more)

### Response shape

```json
{
  "months": [
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
          "videoType": "DRIVE | YOUTUBE | ZOOM | OTHER | null"
        }
      ]
    }
  ],
  "students": [
    {
      "userId": "string",
      "user": {
        "id": "string",
        "email": "string",
        "profile": {
          "fullName": "string",
          "instituteId": "string",
          "avatarUrl": "string | null",
          "phone": "string | null",
          "status": "ACTIVE | INACTIVE | PENDING | OLD"
        }
      },
      "enrolled": "boolean",
      "recordings": [
        {
          "recordingId": "string",
          "attendanceStatus": "COMPLETED | INCOMPLETE | MANUAL | null",
          "attendanceWatchedSec": "number",
          "liveJoinedAt": "string (ISO) | null",
          "completedAt": "string (ISO) | null",
          "sessionCount": "number",
          "totalWatchedSec": "number",
          "lastWatchedAt": "string (ISO) | null",
          "paymentStatus": "FREE | VERIFIED | PENDING | REJECTED | NOT_PAID",
          "sessions": [
            {
              "id": "string",
              "startedAt": "string (ISO)",
              "endedAt": "string (ISO) | null",
              "totalWatchedSec": "number",
              "status": "WATCHING | PAUSED | ENDED"
            }
          ]
        }
      ]
    }
  ]
}
```

> `months` is the column-header metadata — use it to build the table header.  
> Each student's `recordings` array length always equals the number of selected recording IDs, in the same order — safe to access by index to populate table cells.  
> `enrolled: false` means the student accessed the recording without being enrolled in the class.

### Example request

```http
GET /attendance/recordings/users?ids=abc123,def456,ghi789
Authorization: Bearer <admin_token>
```

### Frontend usage — Attendance Grid

Build a table where:
- **Rows** = `students` array
- **Columns** = `months[].recordings[]` flattened (use `months` for grouped headers)
- **Cell** = `student.recordings[colIndex]`

```
| Student         | IID          | Jan 2026 - Lesson 01 | Jan 2026 - Lesson 02 |
|-----------------|--------------|----------------------|----------------------|
| Kamal Perera    | TD-2026-0001 | ✅ COMPLETED (53 min) | ❌ Not watched        |
| Nimal Silva     | TD-2026-0002 | ⏳ INCOMPLETE (12 min)| ✅ COMPLETED (46 min) |
```

#### Cell display logic

```ts
function cellLabel(row: RecordingRow): string {
  if (row.attendanceStatus === 'COMPLETED') return `✅ ${Math.round(row.totalWatchedSec / 60)} min`;
  if (row.attendanceStatus === 'INCOMPLETE') return `⏳ ${Math.round(row.totalWatchedSec / 60)} min`;
  if (row.attendanceStatus === 'MANUAL') return `🖊 Manual`;
  if (row.sessionCount > 0) return `👁 Viewed`;
  return `— Not watched`;
}
```

#### Payment badge logic

```ts
function paymentBadge(status: string): string {
  if (status === 'FREE') return '🆓';
  if (status === 'VERIFIED') return '💚 Paid';
  if (status === 'PENDING') return '🟡 Pending';
  if (status === 'REJECTED') return '🔴 Rejected';
  return '⚪ Unpaid';
}
```

---

## Error responses

| Status | Reason |
|--------|--------|
| `400 Bad Request` | `ids` is empty |
| `401 Unauthorized` | Missing or invalid JWT |
| `403 Forbidden` | Student trying to access admin endpoint |
