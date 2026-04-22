# Public Attendance Import API (Session Based)

Use these endpoints to import class attendance from external systems.

**Production URL:** `https://api.thilinadhananjaya.lk/api/public/attendance/import/...`

**Development URL:** `http://localhost:3001/api/public/attendance/import/...`

**Timezone:** All times are stored and processed in **Sri Lanka Time (UTC+5:30)** or as **ISO 8601 UTC** strings.

Base path with global prefix:

- `/api/public/attendance/import/by-barcode`
- `/api/public/attendance/import/by-institute-id`
- `/api/public/attendance/import/bulk/by-institute-id`

---

## ⏰ Important: Time Format Requirements

### For Bulk Import by Institute ID (No Timezone Conversion)

- **`checkInTime` / `checkOutTime` (HH:mm format):**
  - Send as-is: `"2:00"` → stored as `2:00`
  - Send as-is: `"14:30"` → stored as `14:30`
  - **No conversion applied**
  
- **`checkInAt` / `checkOutAt` / `sessionAt` (ISO datetime):**
  - Must be ISO 8601 UTC: `2026-04-22T02:00:00.000Z`
  - Stored as-is (no conversion)

---

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
  "checkInAt": "2026-04-20T10:10:00.000Z",
  "checkOutAt": "2026-04-20T11:00:00.000Z",
  "note": "Imported from gate scanner"
}
```

### Required Fields

- `sessionId` (string): class attendance session id
- `barcodeId` (string): student barcode id

### Optional Fields

- `status`: `PRESENT | ABSENT | LATE | EXCUSED | NOTMARKED` (default: `PRESENT`)
- `sessionAt`: ISO datetime. If omitted, current server time is used.
- `checkInAt`: ISO datetime for student check-in time
- `checkOutAt`: ISO datetime for student check-out time
- `note`: string

`NOTMARKED` is accepted and normalized to `ABSENT` when stored.

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
  "sessionAt": "2026-04-20T10:12:00.000Z",
  "checkInAt": "2026-04-20T10:10:00.000Z",
  "checkOutAt": "2026-04-20T11:00:00.000Z",
  "note": "Imported from external ERP"
}
```

### Required Fields

- `sessionId` (string): class attendance session id
- `instituteId` (string): student institute id

### Optional Fields

- `status`: `PRESENT | ABSENT | LATE | EXCUSED | NOTMARKED` (default: `PRESENT`)
- `sessionAt`: ISO datetime. If omitted, current server time is used.
- `checkInAt`: ISO datetime for student check-in time
- `checkOutAt`: ISO datetime for student check-out time
- `note`: string

`NOTMARKED` is accepted and normalized to `ABSENT` when stored.

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

- `records[].status`: `PRESENT | ABSENT | LATE | EXCUSED | NOTMARKED` (default: `PRESENT`)
- `records[].date`: `YYYY-MM-DD` (must match the session date)
- `records[].checkInTime`: `HH:mm`
- `records[].checkInAt`: ISO datetime for student check-in time
- `records[].checkOutAt`: ISO datetime for student check-out time
- `records[].note`: string

`NOTMARKED` is accepted and normalized to `ABSENT` when stored.

---

## 4. Bulk Example (Your Payload Pattern)

**Example: Student checks in at 13:52 and checks out at 20:30 Sri Lanka time on 2026-04-22**

```json
{
  "sessionId": "your_session_id",
  "classId": "your_class_id",
  "records": [
    {
      "studentInstituteId": "INS-00123",
      "date": "2026-04-22",
      "checkInTime": "13:52",
      "checkOutTime": "20:30",
      "status": "PRESENT"
    },
    {
      "studentInstituteId": "INS-00124",
      "date": "2026-04-22",
      "checkInAt": "2026-04-22T08:22:00.000Z",
      "checkOutAt": "2026-04-22T15:00:00.000Z",
      "status": "PRESENT",
      "note": "Arrived on time"
    },
    {
      "studentInstituteId": "INS-00125",
      "date": "2026-04-22",
      "status": "ABSENT"
    }
  ]
}
```

### Timezone Breakdown

| Field | Format | Example | Meaning | Stored As |
|-------|--------|---------|---------|-----------|
| `checkInTime` | HH:mm | `2:00` | 2:00 AM | `2:00` (no conversion) |
| `checkOutTime` | HH:mm | `14:30` | 14:30 (2:30 PM) | `14:30` (no conversion) |
| `checkInAt` | ISO UTC | `2026-04-22T02:00:00.000Z` | 2:00 UTC | `2026-04-22T02:00:00.000Z` (as-is) |
| `checkOutAt` | ISO UTC | `2026-04-22T14:30:00.000Z` | 14:30 UTC | `2026-04-22T14:30:00.000Z` (as-is) |

**✅ Simple Rule:** 
- Send any HH:mm time → Stored exactly as-is, no conversion
- Send any ISO datetime → Stored exactly as-is, no conversion

---

## 5. Bulk Processing Rules

- `sessionId` must exist
- `classId` must match that session
- `records[].date` (if provided) must equal session date
- Student must exist by `studentInstituteId`
- Student must be enrolled in the session class
- Invalid rows are reported in `failed[]`; valid rows continue in the same request

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
      "sessionAt": "2026-04-20T10:12:00.000Z",
      "checkInAt": "2026-04-20T10:10:00.000Z",
      "checkOutAt": "2026-04-20T11:00:00.000Z"
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
    "checkInAt": "2026-04-20T10:10:00.000Z",
    "checkOutAt": "2026-04-20T11:00:00.000Z",
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
- `400` for invalid payload values (invalid status/date/time format/etc).

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

---

## 🌏 Timezone Conversion Helper (Sri Lanka UTC+5:30)

### Convert Sri Lanka Time to UTC ISO

To send ISO datetime strings, subtract 5 hours 30 minutes from Sri Lanka time:

**Sri Lanka → UTC (for API)**
```
Sri Lanka: 13:52 (1:52 PM)
UTC:       08:22 (13:52 - 5:30)
ISO:       2026-04-22T08:22:00.000Z
```

### Convert UTC to Sri Lanka Time

To display stored UTC times in Sri Lanka timezone, add 5 hours 30 minutes:

**UTC → Sri Lanka (for display)**
```
UTC:       08:22
Sri Lanka: 13:52 (08:22 + 5:30)
```

### JavaScript Helper

```javascript
// Convert Sri Lanka time string to UTC ISO
function slTimeToUTC(dateString, slTimeString) {
  // dateString: "2026-04-22", slTimeString: "13:52"
  const dt = new Date(`${dateString}T${slTimeString}:00+05:30`);
  return dt.toISOString();
  // Returns: "2026-04-22T08:22:00.000Z"
}

// Convert UTC ISO to Sri Lanka time string
function utcToSLTime(isoString) {
  const dt = new Date(isoString);
  const slTime = new Date(dt.getTime() + 5.5 * 60 * 60 * 1000);
  return slTime.toTimeString().slice(0, 5); // "HH:mm"
}
```
