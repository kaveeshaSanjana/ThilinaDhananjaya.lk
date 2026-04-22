# Class Attendance Management API

Admin endpoints for managing physical class attendance sessions and records.

Base path: `/api/attendance/class-attendance`

All endpoints require admin authentication with `Bearer` token.

---

## Production URL

**Production Backend URL:** `https://api.thilinadhananjaya.lk`

**Development URL:** `http://localhost:3001`

---

## 1. Get Class Attendance Sessions

### `GET /class/:classId/sessions`

Returns all attendance sessions for a specific class.

**Auth:** Admin only

### Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `classId` | string | Yes | The ID of the class |

### Example Request

```http
GET /api/attendance/class-attendance/class/class-physics-2026/sessions
Authorization: Bearer <admin_token>
```

### Example Response

```json
[
  {
    "sessionId": "SES-20260419-0101-AUTOCLOSE",
    "key": "2026-04-19|01:01",
    "date": "2026-04-19",
    "sessionTime": "01:01",
    "sessionCode": null,
    "sessionAt": "2026-04-19T01:01:00.000Z",
    "totalRecords": 25,
    "presentCount": 22,
    "lateCount": 2,
    "absentCount": 1,
    "source": "ATTENDANCE"
  }
]
```

---

## 2. Get Attendance by Date and Session

### `GET /class/:classId/date/:date`

Returns attendance records for a specific class, date, and optional session time.

**Auth:** Admin only

### Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `classId` | string | Yes | The ID of the class |
| `date` | string | Yes | Date in YYYY-MM-DD format |
| `sessionTime` | string | No | Session time in HH:mm format |

### Query Parameters

- `sessionTime`: Filter by specific session time (optional)

### Example Request

```http
GET /api/attendance/class-attendance/class/class-physics-2026/date/2026-04-19?sessionTime=01:01
Authorization: Bearer <admin_token>
```

### Example Response

```json
[
  {
    "id": "attendance_record_id",
    "userId": "student_user_id",
    "status": "PRESENT",
    "date": "2026-04-19",
    "sessionTime": "01:01",
    "sessionCode": null,
    "sessionAt": "2026-04-19T01:01:00.000Z",
    "checkInAt": "2026-04-19T01:02:00.000Z",
    "checkOutAt": "2026-04-19T02:30:00.000Z",
    "method": "barcode",
    "note": null,
    "user": {
      "id": "student_user_id",
      "email": "student@example.com",
      "profile": {
        "fullName": "John Doe",
        "instituteId": "TD-2026-0001",
        "barcodeId": "ST-BAR-0001",
        "avatarUrl": null
      }
    }
  }
]
```

---

## 3. Create Class Attendance Session

### `POST /class/:classId/session`

Creates a new attendance session for a class.

**Auth:** Admin only

### Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `classId` | string | Yes | The ID of the class |

### Request Body

```json
{
  "date": "2026-04-19",
  "sessionTime": "09:00",
  "sessionEndTime": "10:30",
  "sessionCode": "MORNING_SESSION",
  "sessionAt": "2026-04-19T09:00:00.000Z"
}
```

### Response

```json
{
  "message": "Class attendance session created successfully",
  "session": {
    "id": "session_uuid",
    "classId": "class_uuid",
    "date": "2026-04-19",
    "sessionTime": "09:00",
    "sessionEndTime": "10:30",
    "sessionCode": "MORNING_SESSION",
    "sessionAt": "2026-04-19T09:00:00.000Z"
  }
}
```

---

## 4. Close Attendance Session

### `POST /class/:classId/close-date/:date`

Closes attendance for a specific date and session time.

**Auth:** Admin only

### Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `classId` | string | Yes | The ID of the class |
| `date` | string | Yes | Date in YYYY-MM-DD format |

### Request Body

```json
{
  "sessionTime": "09:00"
}
```

### Response

```json
{
  "message": "Attendance session closed successfully",
  "closedRecords": 25
}
```

---

## 5. Close Attendance Session by Session ID

### `POST /session/:sessionId/close`

Closes attendance for a specific session.

**Auth:** Admin only

### Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | The session ID |

### Response

```json
{
  "message": "Attendance session closed successfully",
  "closedRecords": 25
}
```

---

## Response Field Descriptions

### Session Object
| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Unique session identifier |
| `key` | string | `YYYY-MM-DD\|HH:mm` format |
| `date` | string | Session date (YYYY-MM-DD) |
| `sessionTime` | string | Session start time (HH:mm) |
| `sessionCode` | string | Optional session code |
| `sessionAt` | string | Session timestamp (ISO) |
| `totalRecords` | number | Total attendance records |
| `presentCount` | number | Present students count |
| `lateCount` | number | Late students count |
| `absentCount` | number | Absent students count |
| `source` | string | `ATTENDANCE` or `CREATED` |

### Attendance Record Object
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Record ID |
| `userId` | string | Student user ID |
| `status` | string | `PRESENT`, `LATE`, `ABSENT`, `EXCUSED` |
| `date` | string | Attendance date (YYYY-MM-DD) |
| `sessionTime` | string | Session time (HH:mm) |
| `sessionCode` | string | Session code |
| `sessionAt` | string | Session timestamp (ISO) |
| `checkInAt` | string | Check-in timestamp (ISO) |
| `checkOutAt` | string | Check-out timestamp (ISO) |
| `method` | string | Marking method |
| `note` | string | Optional note |
| `user` | object | Student user object |

---

## Error Responses

- `401`: Unauthorized - Invalid or missing token
- `403`: Forbidden - Admin access required
- `404`: Not Found - Class or session not found
- `400`: Bad Request - Invalid parameters
- `500`: Internal Server Error - Database or server issues