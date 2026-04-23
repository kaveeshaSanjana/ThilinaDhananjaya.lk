# Session Attendance API Documentation

## Overview

The Session Attendance API allows you to record and validate student attendance for class sessions. The system automatically checks if students' check-in/check-out times are within the session time window and provides detailed validation feedback.

## Key Features

- **Time Validation**: Automatically validates check-in and check-out times against session time window
- **Early/Late Detection**: Identifies if students arrived early or late with minute-level precision
- **Session Lookup**: Supports both UUID and readable session ID formats (SES-YYYYMMDD-HHMM)
- **Enrollment Verification**: Ensures students are enrolled in the class
- **Bulk Processing**: Process multiple students in a single request with partial success support
- **Detailed Responses**: Comprehensive response data including time validation results and session details

## Endpoints

### 1. Single Student Session Attendance Check

**Endpoint**: `POST /api/public/attendance/session/check`

**Description**: Record attendance for a single student with time validation.

**Request Body**:
```json
{
  "sessionId": "string (required)",
  "instituteId": "string (required)",
  "classId": "string (optional)",
  "checkInAt": "ISO 8601 datetime (required)",
  "checkOutAt": "ISO 8601 datetime (optional)",
  "note": "string (optional)"
}
```

**Parameters**:
- `sessionId`: UUID or readable ID (SES-YYYYMMDD-HHMM) of the class attendance session
- `instituteId`: Student's institute ID (e.g., "TD-2026-00045")
- `classId`: Optional class UUID (required if using readable session ID format)
- `checkInAt`: ISO 8601 datetime string of student's check-in time (UTC)
- `checkOutAt`: ISO 8601 datetime string of student's check-out time (UTC)
- `note`: Optional additional notes

**Response**:
```json
{
  "message": "Session attendance recorded successfully",
  "session": {
    "id": "string",
    "classId": "string",
    "className": "string",
    "date": "YYYY-MM-DD",
    "sessionTime": "HH:mm",
    "sessionEndTime": "HH:mm or null",
    "sessionCode": "string or null",
    "sessionAt": "ISO datetime or null"
  },
  "student": {
    "userId": "string",
    "fullName": "string",
    "instituteId": "string",
    "barcodeId": "string"
  },
  "timeValidation": {
    "isOnTime": "boolean",
    "isEarlyCheckIn": "boolean",
    "isLateCheckIn": "boolean",
    "warning": "string or null"
  },
  "attendance": {
    "id": "string",
    "status": "PRESENT",
    "date": "YYYY-MM-DD",
    "sessionTime": "HH:mm",
    "checkInAt": "ISO datetime",
    "checkOutAt": "ISO datetime or null",
    "method": "public_session_check",
    "note": "string or null",
    "createdAt": "ISO datetime",
    "updatedAt": "ISO datetime"
  }
}
```

**Time Validation Rules**:
- `isOnTime`: True if check-in is between session start and end time
- `isEarlyCheckIn`: True if check-in is before session start time
- `isLateCheckIn`: True if check-in is after session end time (if sessionEndTime is set)
- `warning`: Descriptive message with minutes early/late

**Example Requests**:

```bash
# On-time arrival
curl -X POST http://localhost:3001/api/public/attendance/session/check \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "uuid-or-SES-20260422-1000",
    "instituteId": "TD-2026-00045",
    "checkInAt": "2026-04-22T10:15:00.000Z"
  }'

# Early arrival with checkout
curl -X POST http://localhost:3001/api/public/attendance/session/check \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "uuid-or-SES-20260422-1000",
    "instituteId": "TD-2026-00046",
    "checkInAt": "2026-04-22T09:50:00.000Z",
    "checkOutAt": "2026-04-22T11:00:00.000Z",
    "note": "Arrived early but stayed full session"
  }'

# Late arrival
curl -X POST http://localhost:3001/api/public/attendance/session/check \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "uuid-or-SES-20260422-1000",
    "instituteId": "TD-2026-00047",
    "checkInAt": "2026-04-22T10:45:00.000Z",
    "note": "Traffic delay"
  }'
```

---

### 2. Bulk Session Attendance Check

**Endpoint**: `POST /api/public/attendance/session/bulk-check`

**Description**: Record attendance for multiple students in a single session.

**Request Body**:
```json
{
  "sessionId": "string (required)",
  "classId": "string (required)",
  "records": [
    {
      "studentInstituteId": "string (required)",
      "checkInAt": "ISO 8601 datetime (required)",
      "checkOutAt": "ISO 8601 datetime (optional)",
      "note": "string (optional)"
    }
  ]
}
```

**Parameters**:
- `sessionId`: UUID or readable ID of the session
- `classId`: UUID of the class (required for bulk)
- `records`: Array of attendance records (minimum 1)
  - `studentInstituteId`: Student's institute ID
  - `checkInAt`: ISO 8601 datetime of check-in
  - `checkOutAt`: ISO 8601 datetime of check-out (optional)
  - `note`: Optional additional notes

**Response**:
```json
{
  "message": "Bulk session attendance recorded successfully",
  "session": {
    "id": "string",
    "classId": "string",
    "className": "string",
    "date": "YYYY-MM-DD",
    "sessionTime": "HH:mm",
    "sessionEndTime": "HH:mm or null",
    "sessionCode": "string or null",
    "sessionAt": "ISO datetime or null"
  },
  "summary": {
    "totalRecords": "number",
    "successCount": "number",
    "failedCount": "number"
  },
  "successful": [
    {
      "index": "number (1-based)",
      "studentInstituteId": "string",
      "userId": "string",
      "attendanceId": "string",
      "status": "PRESENT",
      "timeValidation": {
        "isOnTime": "boolean",
        "isEarlyCheckIn": "boolean",
        "isLateCheckIn": "boolean",
        "warning": "string or null"
      }
    }
  ],
  "failed": [
    {
      "index": "number (1-based)",
      "studentInstituteId": "string",
      "reason": "error message"
    }
  ]
}
```

**Processing**:
- Validates all records before processing
- Continues processing even if individual records fail
- Returns successful and failed records separately
- Provides detailed error messages for troubleshooting

**Example Request**:

```bash
curl -X POST http://localhost:3001/api/public/attendance/session/bulk-check \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "uuid-or-SES-20260422-1000",
    "classId": "class-uuid",
    "records": [
      {
        "studentInstituteId": "TD-2026-00045",
        "checkInAt": "2026-04-22T10:12:00.000Z",
        "checkOutAt": "2026-04-22T11:00:00.000Z"
      },
      {
        "studentInstituteId": "TD-2026-00046",
        "checkInAt": "2026-04-22T10:30:00.000Z"
      },
      {
        "studentInstituteId": "TD-2026-00047",
        "checkInAt": "2026-04-22T09:50:00.000Z",
        "note": "Early arrival"
      }
    ]
  }'
```

---

## Session ID Formats

The system supports multiple session ID formats for flexibility:

### UUID Format
- **Format**: Standard UUID (36 characters)
- **Example**: `a123b456-c789-d000-e111-f222g333h444`
- **Usage**: Direct lookup in database
- **Requirements**: `classId` is optional

### Readable Format
- **Format**: `SES-YYYYMMDD-HHMM`
- **Example**: `SES-20260422-1000` (April 22, 2026, 10:00 AM)
- **Usage**: Human-readable, easier to generate
- **Requirements**: `classId` is required

### Readable Format with Session Code
- **Format**: `SES-YYYYMMDD-HHMM-CODE`
- **Example**: `SES-20260422-1000-MORNING_BATCH`
- **Usage**: Includes custom session code
- **Requirements**: `classId` is required

---

## Time Validation Logic

### How Time Validation Works

The system validates check-in and check-out times against the session time window:

1. **Session Time Window**:
   - Start: Session start time (e.g., 10:00)
   - End: Session end time (optional, e.g., 11:00)

2. **Check-in Validation**:
   - **On Time**: Check-in is within [sessionStart, sessionEnd]
   - **Early**: Check-in is before sessionStart
   - **Late**: Check-in is after sessionEnd

3. **Check-out Validation**:
   - Must be after or equal to check-in time
   - If after sessionEnd, warning is appended

4. **Warning Messages**:
   - "Checked in 10 minutes early"
   - "Checked in 15 minutes after session ended"
   - Combined messages for complex scenarios

### Example Scenarios

**Scenario 1: Session 10:00 - 11:00**
- Student checks in at 10:15: **isOnTime = true** ✓
- Student checks in at 09:50: **isEarlyCheckIn = true** (10 min early)
- Student checks in at 11:15: **isLateCheckIn = true** (15 min late)

**Scenario 2: No Session End Time**
- Any check-in after sessionStart is considered on time
- Useful for flexible session durations

**Scenario 3: With Check-out**
- Check-in 10:12, Check-out 11:00: Both validated
- Check-out must be after check-in
- If check-out is after sessionEnd, warning is appended

---

## Error Handling

### Common Errors

**1. Session Not Found**
```json
{
  "statusCode": 404,
  "message": "Class attendance session not found: invalid-id",
  "error": "Not Found"
}
```

**2. Student Not Found**
```json
{
  "statusCode": 404,
  "message": "No student found for institute ID: TD-2026-99999",
  "error": "Not Found"
}
```

**3. Student Not Enrolled**
```json
{
  "statusCode": 400,
  "message": "Student is not enrolled in this class",
  "error": "Bad Request"
}
```

**4. Invalid Time Format**
```json
{
  "statusCode": 400,
  "message": "Invalid checkInAt datetime",
  "error": "Bad Request"
}
```

**5. Invalid Time Order**
```json
{
  "statusCode": 400,
  "message": "checkOutAt must be later than or equal to checkInAt",
  "error": "Bad Request"
}
```

**6. Missing Required Field**
```json
{
  "statusCode": 400,
  "message": "sessionId should not be empty",
  "error": "Bad Request"
}
```

---

## Best Practices

### 1. **Use ISO 8601 UTC Times**
Always send times in UTC format (with Z suffix):
```
✓ Correct:   2026-04-22T10:15:00.000Z
✗ Incorrect: 2026-04-22T10:15:00 (missing Z)
✗ Incorrect: 2026-04-22 10:15:00
```

### 2. **Handle Partial Failures in Bulk Requests**
Always check both `successful` and `failed` arrays:
```json
{
  "successful": [...],  // Process these successfully
  "failed": [...]       // Retry or log these
}
```

### 3. **Validate Time Validation Results**
Review the `timeValidation` object for warnings:
```json
{
  "isOnTime": true,
  "warning": null        // ✓ No issues
}

{
  "isLateCheckIn": true,
  "warning": "Checked in 15 minutes after session ended"  // ⚠️ Issue noted
}
```

### 4. **Store Session IDs for Reuse**
Use readable session IDs for easier tracking and auditing:
```
SES-20260422-1000  // Easy to read and generate
```

### 5. **Include Notes for Context**
Add notes for important details:
```json
{
  "note": "Traffic delay - arrived late but approved to attend"
}
```

---

## Integration Examples

### Example 1: Gate/Scanner System
```bash
# When student scans QR code at gate
curl -X POST http://localhost:3001/api/public/attendance/session/check \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SES-20260422-1000",
    "instituteId": "TD-2026-00045",
    "classId": "class-uuid",
    "checkInAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
    "note": "Scanned at gate"
  }'
```

### Example 2: Bulk Import from External System
```bash
# Import attendance data from external ERP
curl -X POST http://localhost:3001/api/public/attendance/session/bulk-check \
  -H "Content-Type: application/json" \
  -d @bulk_session_data.json
```

### Example 3: Timezone Handling
```bash
# Convert local time to UTC before sending
# Example: Asia/Colombo time (UTC+5:30)
# Local: 2026-04-22 15:45:00
# UTC:   2026-04-22T10:15:00.000Z (subtract 5.5 hours)

const localTime = new Date('2026-04-22T15:45:00');
const utcTime = new Date(localTime.getTime() - (5.5 * 60 * 60 * 1000));
const isoString = utcTime.toISOString();
// Result: "2026-04-22T10:15:00.000Z"
```

---

## Database Schema

### ClassAttendanceSession
```
id              - UUID
classId         - FK to Class
date            - Session date
sessionTime     - HH:mm format (e.g., "10:00")
sessionEndTime  - HH:mm format (optional, e.g., "11:00")
sessionCode     - Optional custom code
sessionAt       - ISO datetime
createdAt       - Timestamp
updatedAt       - Timestamp
```

### ClassAttendance
```
id              - UUID
userId          - FK to User (student)
classId         - FK to Class
date            - Attendance date
sessionTime     - HH:mm format
checkInAt       - ISO datetime (optional)
checkOutAt      - ISO datetime (optional)
status          - PRESENT, ABSENT, LATE, EXCUSED
method          - How attendance was recorded
note            - Additional notes
createdAt       - Timestamp
updatedAt       - Timestamp
```

---

## Troubleshooting

### Q: "Student is not enrolled in this class"
**A**: Verify the student's enrollment in the specific class. Use enrollment endpoints to enroll the student first.

### Q: "Class attendance session not found"
**A**: 
- Check if session exists in the database
- Verify session ID format (UUID or readable SES-YYYYMMDD-HHMM)
- For readable format, ensure classId is provided

### Q: Times are showing as incorrect
**A**: 
- Ensure times are in UTC format (ISO 8601 with Z)
- Check timezone conversions if using local times
- Verify database time configuration

### Q: Bulk request fails on one record
**A**: 
- This is normal - check the `failed` array for specific reasons
- Retry individual failed records after fixing issues
- Review error messages for guidance

### Q: No warning even though arrival is late
**A**: 
- Check if `sessionEndTime` is set for the session
- Late detection requires an end time
- If no end time, only `sessionTime` is used as reference

---

## API Versioning

Current version: **v1 (Public API)**
- Endpoint prefix: `/api/public/attendance/session/`
- Stability: Stable for production use
- Breaking changes will be announced in advance

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review error messages in the response
3. Verify request format and data types
4. Check database connectivity and session existence
5. Review attendance service logs for details
