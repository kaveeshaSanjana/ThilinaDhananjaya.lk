# Public Attendance Import API (Session Based)

Use these endpoints to import class attendance from external systems.

Base path with global prefix:

- `/api/public/attendance/import/by-barcode`
- `/api/public/attendance/import/by-institute-id`
- `/api/public/attendance/import/bulk/by-institute-id`

## 1. Import by Barcode

### Endpoint

```http
POST /api/public/attendance/import/by-barcode
Content-Type: application/json
```

### Request Body

```json
{
  "sessionId": "cls_session_uuid",
  "barcodeId": "ST-BAR-00045",
  "status": "PRESENT",
  "sessionAt": "2026-04-20T10:12:00.000Z",
  "note": "Imported from gate scanner"
}
```

### Required Fields

- `sessionId` (string): class attendance session id
- `barcodeId` (string): student barcode id

### Optional Fields

- `status`: `PRESENT | ABSENT | LATE | EXCUSED` (default: `PRESENT`)
- `sessionAt`: ISO datetime. If omitted, current server time is used.
- `note`: string

---

## 2. Import by Institute Student ID

### Endpoint

```http
POST /api/public/attendance/import/by-institute-id
Content-Type: application/json
```

### Request Body

```json
{
  "sessionId": "cls_session_uuid",
  "instituteId": "TD-2026-00045",
  "status": "PRESENT",
  "note": "Imported from external ERP"
}
```

### Required Fields

- `sessionId` (string): class attendance session id
- `instituteId` (string): student institute id

### Optional Fields

- `status`: `PRESENT | ABSENT | LATE | EXCUSED` (default: `PRESENT`)
- `sessionAt`: ISO datetime. If omitted, current server time is used.
- `note`: string

---

## Validation Rules Applied

For both endpoints:

1. `sessionId` must exist in class attendance sessions.
2. Student must exist by the supplied identifier.
3. Student must be enrolled in the class linked to that session.
4. Attendance is upserted for that exact class/date/sessionTime.

---

## 3. Bulk Import by Institute Student ID

### Endpoint

```http
POST /api/public/attendance/import/bulk/by-institute-id
Content-Type: application/json
```

### Request Body

```json
{
  "sessionId": "cls_session_uuid",
  "classId": "class_uuid",
  "records": [
    {
      "studentInstituteId": "TD-2026-00045",
      "date": "2026-04-20",
      "checkInTime": "10:12",
      "status": "PRESENT"
    },
    {
      "studentInstituteId": "TD-2026-00046",
      "checkInAt": "2026-04-20T10:14:33.000Z",
      "status": "LATE",
      "note": "Arrived after bell"
    }
  ]
}
```

### Required Fields

- `sessionId` (string)
- `classId` (string)
- `records` (array, at least 1 item)
- `records[].studentInstituteId` (string)

### Optional Per-Record Fields

- `records[].status`: `PRESENT | ABSENT | LATE | EXCUSED` (default: `PRESENT`)
- `records[].date`: `YYYY-MM-DD` (must match the session date)
- `records[].checkInTime`: `HH:mm`
- `records[].checkInAt`: ISO datetime
- `records[].note`: string

### Bulk Response (Enhanced Summary)

```json
{
  "message": "Bulk attendance import processed",
  "session": {
    "id": "cls_session_uuid",
    "classId": "class_uuid",
    "className": "Grade 10 Maths",
    "date": "2026-04-20",
    "sessionTime": "10:00",
    "sessionCode": "MORNING_BATCH",
    "sessionAt": "2026-04-20T10:00:00.000Z"
  },
  "classId": "class_uuid",
  "summary": {
    "totalRecords": 2,
    "successCount": 1,
    "failedCount": 1
  },
  "successful": [
    {
      "index": 1,
      "studentInstituteId": "TD-2026-00045",
      "userId": "user_uuid_45",
      "attendanceId": "attendance_uuid_45",
      "status": "PRESENT",
      "sessionAt": "2026-04-20T10:12:00.000Z"
    }
  ],
  "failed": [
    {
      "index": 2,
      "studentInstituteId": "TD-2026-00999",
      "reason": "No student found for institute ID: TD-2026-00999"
    }
  ]
}
```

This response gives exact counts and failed student IDs with reasons.

---

## Success Response (Both Endpoints)

```json
{
  "message": "Attendance imported successfully",
  "session": {
    "id": "cls_session_uuid",
    "classId": "class_uuid",
    "className": "Grade 10 Maths",
    "date": "2026-04-20",
    "sessionTime": "10:00",
    "sessionCode": "MORNING_BATCH",
    "sessionAt": "2026-04-20T10:00:00.000Z"
  },
  "student": {
    "userId": "user_uuid",
    "fullName": "Student Name",
    "instituteId": "TD-2026-00045",
    "barcodeId": "ST-BAR-00045"
  },
  "attendance": {
    "id": "attendance_uuid",
    "status": "PRESENT",
    "date": "2026-04-20",
    "sessionTime": "10:00",
    "sessionCode": "MORNING_BATCH",
    "sessionAt": "2026-04-20T10:12:00.000Z",
    "method": "public_import_barcode",
    "note": "Imported from gate scanner",
    "createdAt": "2026-04-20T10:12:01.000Z",
    "updatedAt": "2026-04-20T10:12:01.000Z"
  }
}
```

---

## Error Cases

- `404` if session is not found.
- `404` if student is not found by barcode or institute id.
- `400` if student is not enrolled in that session's class.
- `400` if `sessionId` does not belong to `classId` in bulk import.
- `400` if a bulk record `date` does not match session date.
- `400` for invalid payload values (invalid status/date format/etc).

---

## How to Get sessionId

Admin can call:

```http
GET /api/attendance/class-attendance/class/:classId/sessions
Authorization: Bearer <admin_token>
```

Each session row now includes:

- `sessionId` (UUID) for API imports
- `key` (`YYYY-MM-DD|HH:mm`) for UI operations
