# Attendance API

Base path: `/attendance`

All authenticated endpoints require a `Bearer` token in the `Authorization` header.

---

## Config

### `GET /attendance/config`
> Public — no authentication required

Returns the push duration threshold and heartbeat interval used by the frontend player.

**Response**
```json
{
  "pushDurationSeconds": 60,
  "heartbeatIntervalSeconds": 120
}
```

---

## Attendance Records

### `POST /attendance/mark`
> Auth: Student

Mark attendance as **COMPLETED** when the student reaches the watch threshold. Duplicate completions for the same recording are ignored.

**Body**
```json
{
  "recordingId": "string",
  "watchedSec": 120
}
```

---

### `POST /attendance/incomplete`
> Auth: Student

Log an **INCOMPLETE** attempt (called via `beacon` / `unload` when the student navigates away before reaching the threshold).

**Body**
```json
{
  "recordingId": "string",
  "watchedSec": 45
}
```

---

### `POST /attendance/manual`
> Auth: Admin

Manually mark attendance for a student.

**Body**
```json
{
  "userId": "string",
  "recordingId": "string (optional)",
  "eventName": "string (optional)"
}
```

---

### `GET /attendance`
> Auth: Admin

Returns attendance records (up to 500). All query parameters are optional — omit them to get all records.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `classId` | string | Filter by class |
| `recordingId` | string | Filter by recording |
| `status` | string | Filter by status: `COMPLETED`, `INCOMPLETE`, or `MANUAL` |

**Example Requests**
```http
GET /api/attendance
GET /api/attendance?classId=ee134162-3b4e-430b-9b40-6393a6b92689
GET /api/attendance?status=COMPLETED
GET /api/attendance?classId=ee134162-...&status=INCOMPLETE
GET /api/attendance?recordingId=2ecb26f8-1c6f-46ed-85f9-616d2526a1c9
```

**Response** — array of attendance records including student profile and recording/class info.

---

### `GET /attendance/my`
> Auth: Student

Returns the authenticated student's full attendance history.

---

### `GET /attendance/user/:userId`
> Auth: Admin

Returns all attendance records for a specific student.

| Param | Type | Description |
|-------|------|-------------|
| `userId` | string | The user's ID |

---

### `GET /attendance/recording/:recordingId`
> Auth: Admin

Returns all attendance records for a specific recording.

| Param | Type | Description |
|-------|------|-------------|
| `recordingId` | string | The recording's ID |

---

### `GET /attendance/class/:classId`
> Auth: Admin

Returns all attendance records for **every recording** that belongs to the given class (resolved via `recording → month → class`).

| Param | Type | Description |
|-------|------|-------------|
| `classId` | string | The class ID |

**Response** — array of records, each containing:
```json
{
  "id": "string",
  "status": "COMPLETED | INCOMPLETE | MANUAL",
  "watchedSec": 120,
  "createdAt": "2026-04-01T00:00:00.000Z",
  "user": {
    "profile": {
      "fullName": "string",
      "instituteId": "string"
    }
  },
  "recording": {
    "title": "string",
    "month": {
      "name": "string",
      "class": {
        "id": "string",
        "name": "string"
      }
    }
  }
}
```

---

## Watch Sessions

### `POST /attendance/session/start`
> Auth: Student

Start a new watch session. Any existing active session for the same user + recording is ended automatically.

**Body**
```json
{
  "recordingId": "string",
  "videoPosition": 0,
  "events": [] 
}
```

**Response** — the created `WatchSession` object including `id`.

---

### `POST /attendance/session/heartbeat`
> Auth: Student

Update the current watch session with the latest video position and watched seconds. Call this on a regular interval (see `heartbeatIntervalSeconds` from `/attendance/config`).

**Body**
```json
{
  "sessionId": "string",
  "videoPosition": 45,
  "watchedSec": 40,
  "events": []
}
```

---

### `POST /attendance/session/end`
> Auth: Student

End an active watch session.

**Body**
```json
{
  "sessionId": "string",
  "videoPosition": 120,
  "watchedSec": 115,
  "events": []
}
```

---

### `POST /attendance/session/end-beacon`
> Public — no authentication required

End a session via `navigator.sendBeacon` (browser `unload` event). No `Authorization` header is possible with `sendBeacon`, so this endpoint is intentionally public. Uses `sessionId` to look up the session.

**Body**
```json
{
  "sessionId": "string",
  "videoPosition": 80,
  "watchedSec": 75,
  "events": []
}
```

---

## Watch History

### `GET /attendance/watch-history/my`
> Auth: Student

Returns all watch sessions for the authenticated student.

---

### `GET /attendance/watch-history/recording/:recordingId`
> Auth: Student

Returns the authenticated student's watch sessions for a specific recording.

| Param | Type | Description |
|-------|------|-------------|
| `recordingId` | string | The recording's ID |

---

### `GET /attendance/watch-history/admin/recording/:recordingId`
> Auth: Admin

Returns all students' watch sessions for a specific recording.

| Param | Type | Description |
|-------|------|-------------|
| `recordingId` | string | The recording's ID |

---

### `GET /attendance/watch-sessions`
> Auth: Admin

Returns all watch sessions across all students and recordings.

---

## Attendance Status Values

| Status | Description |
|--------|-------------|
| `COMPLETED` | Student watched enough to meet the threshold |
| `INCOMPLETE` | Student left before reaching the threshold |
| `MANUAL` | Manually marked by an admin |
