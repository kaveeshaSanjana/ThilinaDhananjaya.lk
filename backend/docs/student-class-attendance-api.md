# Student Class Attendance API

Allows a logged-in student to retrieve their own physical (date-based) class attendance records, optionally filtered to a specific class.

---

## Endpoint

```
GET /attendance/my/class-attendance
Authorization: Bearer <student-jwt>
```

### Query Params

| Param     | Type   | Required | Description                                        |
|-----------|--------|----------|----------------------------------------------------|
| `classId` | string | ❌       | Filter results to a single class. If omitted, returns attendance across all enrolled classes. |

---

## Response `200`

```json
{
  "userId": "user_clxxxxx",
  "totalClasses": 2,
  "classes": [
    {
      "class": {
        "id": "class_clxxxxx",
        "name": "Grade 10 Maths",
        "subject": "Mathematics"
      },
      "records": [
        {
          "id": "ca_clxxxxx",
          "date": "2025-08-05T00:00:00.000Z",
          "status": "PRESENT",
          "method": "barcode",
          "note": null
        },
        {
          "id": "ca_clyyyyy",
          "date": "2025-08-12T00:00:00.000Z",
          "status": "LATE",
          "method": "manual",
          "note": "Arrived 10 mins late"
        },
        {
          "id": "ca_clzzzzz",
          "date": "2025-08-19T00:00:00.000Z",
          "status": "ABSENT",
          "method": null,
          "note": null
        }
      ],
      "summary": {
        "total": 3,
        "present": 1,
        "late": 1,
        "absent": 1,
        "excused": 0,
        "attendancePercentage": 67
      }
    }
  ]
}
```

### Response Fields

| Field                          | Type    | Description                                              |
|--------------------------------|---------|----------------------------------------------------------|
| `userId`                       | string  | The authenticated student's ID                           |
| `totalClasses`                 | integer | Number of distinct classes returned                      |
| `classes[].class`              | object  | Class info: `id`, `name`, `subject`                     |
| `classes[].records`            | array   | All attendance records for that class                    |
| `records[].id`                 | string  | Record ID                                                |
| `records[].date`               | ISO8601 | Date of the class session                                |
| `records[].status`             | string  | `PRESENT`, `LATE`, `ABSENT`, or `EXCUSED`               |
| `records[].method`             | string  | How it was marked: `barcode`, `institute_id`, `manual`, `phone`, `bulk`, etc. |
| `records[].note`               | string  | Optional note from the admin                             |
| `summary.total`                | integer | Total sessions recorded                                  |
| `summary.present`              | integer | Sessions marked PRESENT                                  |
| `summary.late`                 | integer | Sessions marked LATE                                     |
| `summary.absent`               | integer | Sessions marked ABSENT                                   |
| `summary.excused`              | integer | Sessions marked EXCUSED                                  |
| `summary.attendancePercentage` | integer | `(present + late) / total × 100`, rounded               |

### Attendance Status Values

| Status    | Description            |
|-----------|------------------------|
| `PRESENT` | Student was on time    |
| `LATE`    | Student arrived late   |
| `ABSENT`  | Student was absent     |
| `EXCUSED` | Absence was excused    |

---

## Examples

### Get all class attendance across all classes

```
GET /attendance/my/class-attendance
Authorization: Bearer <token>
```

### Get attendance for a specific class only

```
GET /attendance/my/class-attendance?classId=class_clxxxxx
Authorization: Bearer <token>
```

Response will have `totalClasses: 1` and a single entry in the `classes` array.

---

## Error Responses

| Status | Reason                  |
|--------|-------------------------|
| `401`  | Missing or invalid JWT  |
