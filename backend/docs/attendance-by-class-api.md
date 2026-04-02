# Get Attendance by Class API

## `GET /attendance/class/:classId`

Returns all attendance records for every recording that belongs to the given class.

**Auth:** Admin only (`Bearer <token>`)

---

### URL Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `classId` | string | Yes | The ID of the class |

---

### Example Request

```http
GET /attendance/class/sample-class-1
Authorization: Bearer <admin_token>
```

---

### Example Response

```json
[
  {
    "id": "clxyz123",
    "status": "COMPLETED",
    "watchedSec": 120,
    "eventName": null,
    "createdAt": "2026-04-01T10:00:00.000Z",
    "user": {
      "profile": {
        "fullName": "Test Student",
        "instituteId": "TD-2026-0001"
      }
    },
    "recording": {
      "title": "Introduction to Limits",
      "month": {
        "name": "January 2026",
        "class": {
          "id": "sample-class-1",
          "name": "Combined Mathematics"
        }
      }
    }
  }
]
```

---

### Attendance Status Values

| Status | Description |
|--------|-------------|
| `COMPLETED` | Student watched enough to meet the threshold |
| `INCOMPLETE` | Student left before reaching the threshold |
| `MANUAL` | Manually marked by an admin |

---

### Error Responses

| Status | Description |
|--------|-------------|
| `401 Unauthorized` | Missing or invalid token |
| `403 Forbidden` | Authenticated user is not an Admin |
