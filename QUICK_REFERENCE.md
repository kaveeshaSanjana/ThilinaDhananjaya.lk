# Session Attendance API - Quick Reference

## New Endpoints

### 1. Single Student Session Attendance Check
```
POST /api/public/attendance/session/check
```

**Minimal Request**:
```json
{
  "sessionId": "SES-20260422-1000",
  "instituteId": "TD-2026-00045",
  "checkInAt": "2026-04-22T10:15:00.000Z"
}
```

**Full Request**:
```json
{
  "sessionId": "uuid-or-readable",
  "instituteId": "student-id",
  "classId": "class-uuid-if-readable-session",
  "checkInAt": "ISO-datetime",
  "checkOutAt": "ISO-datetime-optional",
  "note": "optional text"
}
```

---

### 2. Bulk Session Attendance Check
```
POST /api/public/attendance/session/bulk-check
```

**Request**:
```json
{
  "sessionId": "uuid-or-SES-YYYYMMDD-HHMM",
  "classId": "class-uuid",
  "records": [
    {
      "studentInstituteId": "TD-2026-00045",
      "checkInAt": "2026-04-22T10:15:00.000Z",
      "checkOutAt": "2026-04-22T11:00:00.000Z",
      "note": "optional"
    }
  ]
}
```

---

## Time Validation Results

Every response includes `timeValidation` object:

| Field | Type | Meaning |
|-------|------|---------|
| `isOnTime` | bool | Arrived during session window |
| `isEarlyCheckIn` | bool | Arrived before session start |
| `isLateCheckIn` | bool | Arrived after session end |
| `warning` | string \| null | Descriptive warning (early/late minutes) |

---

## Session ID Formats

| Format | Example | Requires classId |
|--------|---------|------------------|
| UUID | `a123b456-c789-d000-e111-f222g333h444` | No |
| Readable | `SES-20260422-1000` | Yes |
| With Code | `SES-20260422-1000-MORNING_BATCH` | Yes |

---

## Time Format

**Always use ISO 8601 UTC format**:
```
✓ 2026-04-22T10:15:00.000Z
✗ 2026-04-22 10:15:00
✗ 22-04-2026 10:15
```

---

## Response Structure

```json
{
  "message": "Session attendance recorded successfully",
  "session": {...},
  "student": {...},
  "timeValidation": {
    "isOnTime": true,
    "isEarlyCheckIn": false,
    "isLateCheckIn": false,
    "warning": null
  },
  "attendance": {...}
}
```

---

## Bulk Response

```json
{
  "message": "Bulk session attendance recorded successfully",
  "session": {...},
  "summary": {
    "totalRecords": 3,
    "successCount": 2,
    "failedCount": 1
  },
  "successful": [
    {
      "index": 1,
      "studentInstituteId": "TD-2026-00045",
      "userId": "...",
      "attendanceId": "...",
      "status": "PRESENT",
      "timeValidation": {...}
    }
  ],
  "failed": [
    {
      "index": 3,
      "studentInstituteId": "TD-2026-00047",
      "reason": "Student is not enrolled in this class"
    }
  ]
}
```

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| Session not found | Invalid session ID | Verify session exists, use correct ID format |
| Student not found | Invalid institute ID | Verify student exists with exact ID |
| Not enrolled | Student not in class | Enroll student in class first |
| Invalid datetime | Wrong time format | Use ISO 8601 UTC: `2026-04-22T10:15:00.000Z` |
| Missing field | Required param omitted | Check all required fields are provided |

---

## Real-World Examples

### Gate/Scanner System
```javascript
const response = await fetch('/api/public/attendance/session/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: currentSessionId,
    instituteId: scannedStudentId,
    checkInAt: new Date().toISOString(),
    note: 'Scanned at gate'
  })
});

const result = await response.json();
if (result.timeValidation.isLateCheckIn) {
  console.warn(`⚠️ ${result.timeValidation.warning}`);
}
```

### Bulk Import from External System
```javascript
const students = [
  { studentInstituteId: 'TD-2026-00045', checkInAt: '2026-04-22T10:12:00.000Z' },
  { studentInstituteId: 'TD-2026-00046', checkInAt: '2026-04-22T10:30:00.000Z' }
];

const response = await fetch('/api/public/attendance/session/bulk-check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: sessionId,
    classId: classId,
    records: students
  })
});

const result = await response.json();
console.log(`✓ ${result.summary.successCount} succeeded`);
console.log(`✗ ${result.summary.failedCount} failed`);
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/public/public.controller.ts` | API endpoints |
| `src/attendance/attendance.service.ts` | Business logic & time validation |
| `docs/session-attendance-api.md` | Complete documentation |
| `session_attendance_check.json` | Single student examples |
| `bulk_session_attendance_check.json` | Bulk operation examples |

---

## Important Notes

1. **Public API**: No authentication required
2. **Enrollment Required**: Student must be enrolled before recording attendance
3. **Session Must Exist**: Session must be created before recording attendance
4. **UTC Times**: All times must be in UTC (ISO 8601 with Z)
5. **Partial Success**: Bulk requests continue even if individual records fail
6. **Time Validation**: Automatic - system checks against session start/end times

---

## Integration Checklist

- [ ] Create class
- [ ] Create class attendance session
- [ ] Create student account
- [ ] Enroll student in class
- [ ] Call `/api/public/attendance/session/check` or `/bulk-check`
- [ ] Check response for time validation results
- [ ] Handle warnings and errors appropriately

---

## Support

📖 Full documentation: `backend/docs/session-attendance-api.md`
📝 Examples: See JSON files in `backend/` directory
💻 TypeScript: All code validated and compiled successfully
