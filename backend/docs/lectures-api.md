# Lectures API

Manage lectures attached to class months. Lectures can have different visibility statuses so
admins control what students see.

---

## Enums

### LectureMode
| Value     | Description          |
|-----------|----------------------|
| `ONLINE`  | Online session       |
| `OFFLINE` | In-person / offline  |

### LectureStatus
| Value           | Visible to (non-admin) |
|-----------------|------------------------|
| `ANYONE`        | All visitors           |
| `STUDENTS_ONLY` | Enrolled students      |
| `PAID_ONLY`     | Paid / enrolled only   |
| `PRIVATE`       | Hidden (not returned)  |
| `INACTIVE`      | Hidden (not returned)  |

> **Note:** `PRIVATE` and `INACTIVE` lectures are excluded from non-admin responses.
> Admins see all statuses except `INACTIVE` (filtered server-side with `not: INACTIVE`).

---

## Endpoints

### 1. Create Lecture *(Admin)*

```
POST /lectures/month/:monthId
Authorization: Bearer <admin-jwt>
Content-Type: application/json
```

**Path Params**

| Param     | Type   | Description              |
|-----------|--------|--------------------------|
| `monthId` | string | ID of the class month    |

**Request Body**

| Field             | Type    | Required | Default         | Description                   |
|-------------------|---------|----------|-----------------|-------------------------------|
| `title`           | string  | ✅       | —               | Lecture title                 |
| `description`     | string  | ❌       | null            | Optional description          |
| `mode`            | enum    | ❌       | `ONLINE`        | `ONLINE` or `OFFLINE`         |
| `platform`        | string  | ❌       | null            | e.g. `"Zoom"`, `"Google Meet"`|
| `startTime`       | ISO8601 | ✅       | —               | Lecture start datetime        |
| `endTime`         | ISO8601 | ✅       | —               | Lecture end datetime          |
| `sessionLink`     | string  | ❌       | null            | Meeting join URL              |
| `meetingId`       | string  | ❌       | null            | Meeting ID                    |
| `meetingPassword` | string  | ❌       | null            | Meeting password              |
| `maxParticipants` | integer | ❌       | null            | Max participant count         |
| `status`          | enum    | ❌       | `STUDENTS_ONLY` | Visibility status             |

**Example Request**

```json
{
  "title": "Introduction to Algebra",
  "description": "Cover chapters 1-3",
  "mode": "ONLINE",
  "platform": "Zoom",
  "startTime": "2025-08-01T10:00:00.000Z",
  "endTime": "2025-08-01T12:00:00.000Z",
  "sessionLink": "https://zoom.us/j/123456789",
  "meetingId": "123 456 789",
  "meetingPassword": "abc123",
  "maxParticipants": 100,
  "status": "STUDENTS_ONLY"
}
```

**Response `201`**

```json
{
  "id": "lec_clxxxxx",
  "monthId": "month_clxxxxx",
  "title": "Introduction to Algebra",
  "description": "Cover chapters 1-3",
  "mode": "ONLINE",
  "platform": "Zoom",
  "startTime": "2025-08-01T10:00:00.000Z",
  "endTime": "2025-08-01T12:00:00.000Z",
  "sessionLink": "https://zoom.us/j/123456789",
  "meetingId": "123 456 789",
  "meetingPassword": "abc123",
  "maxParticipants": 100,
  "status": "STUDENTS_ONLY",
  "createdAt": "2025-07-20T08:00:00.000Z",
  "updatedAt": "2025-07-20T08:00:00.000Z",
  "month": {
    "id": "month_clxxxxx",
    "name": "August 2025",
    "year": 2025,
    "month": 8,
    "class": {
      "id": "class_clxxxxx",
      "name": "Grade 10 Maths",
      "subject": "Mathematics"
    }
  }
}
```

**Error Responses**

| Status | Reason                |
|--------|-----------------------|
| `401`  | Missing / invalid JWT |
| `403`  | Not an admin          |
| `404`  | Month not found       |

---

### 2. Update Lecture *(Admin)*

```
PATCH /lectures/:id
Authorization: Bearer <admin-jwt>
Content-Type: application/json
```

**Path Params**

| Param | Type   | Description  |
|-------|--------|--------------|
| `id`  | string | Lecture ID   |

**Request Body** — all fields optional, same as Create

**Response `200`** — updated lecture object (same shape as Create response)

**Error Responses**

| Status | Reason              |
|--------|---------------------|
| `401`  | Not authenticated   |
| `403`  | Not an admin        |
| `404`  | Lecture not found   |

---

### 3. Delete Lecture *(Admin)*

```
DELETE /lectures/:id
Authorization: Bearer <admin-jwt>
```

**Response `200`** — deleted lecture object

**Error Responses**

| Status | Reason            |
|--------|-------------------|
| `401`  | Not authenticated |
| `403`  | Not an admin      |
| `404`  | Lecture not found |

---

### 4. Get All Lectures *(Admin)*

```
GET /lectures
Authorization: Bearer <admin-jwt>
```

**Query Params**

| Param     | Type    | Required | Description                          |
|-----------|---------|----------|--------------------------------------|
| `monthId` | string  | ❌       | Filter by class month                |
| `status`  | enum    | ❌       | Filter by status                     |
| `page`    | integer | ❌       | Page number (default: `1`)           |
| `limit`   | integer | ❌       | Results per page (default: `50`, max: `200`) |

**Response `200`**

```json
{
  "data": [
    {
      "id": "lec_clxxxxx",
      "monthId": "month_clxxxxx",
      "title": "Introduction to Algebra",
      "mode": "ONLINE",
      "platform": "Zoom",
      "startTime": "2025-08-01T10:00:00.000Z",
      "endTime": "2025-08-01T12:00:00.000Z",
      "status": "STUDENTS_ONLY",
      "createdAt": "2025-07-20T08:00:00.000Z",
      "updatedAt": "2025-07-20T08:00:00.000Z",
      "month": {
        "id": "month_clxxxxx",
        "name": "August 2025",
        "year": 2025,
        "month": 8,
        "class": {
          "id": "class_clxxxxx",
          "name": "Grade 10 Maths",
          "subject": "Mathematics"
        }
      }
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

---

### 5. Get Lectures by Month *(All users)*

```
GET /lectures/month/:monthId
Authorization: Bearer <jwt>  (optional)
```

Returns lectures for the given month. Visibility is filtered based on the caller's role:

- **Admin** — all statuses except `INACTIVE`
- **Authenticated user / anonymous** — only `ANYONE`, `STUDENTS_ONLY`, `PAID_ONLY`

**Path Params**

| Param     | Type   | Description        |
|-----------|--------|--------------------|
| `monthId` | string | Class month ID     |

**Response `200`**

```json
{
  "month": {
    "id": "month_clxxxxx",
    "name": "August 2025",
    "year": 2025,
    "month": 8,
    "class": {
      "id": "class_clxxxxx",
      "name": "Grade 10 Maths",
      "subject": "Mathematics"
    }
  },
  "lectures": [
    {
      "id": "lec_clxxxxx",
      "monthId": "month_clxxxxx",
      "title": "Introduction to Algebra",
      "description": "Cover chapters 1-3",
      "mode": "ONLINE",
      "platform": "Zoom",
      "startTime": "2025-08-01T10:00:00.000Z",
      "endTime": "2025-08-01T12:00:00.000Z",
      "sessionLink": "https://zoom.us/j/123456789",
      "meetingId": "123 456 789",
      "meetingPassword": "abc123",
      "maxParticipants": 100,
      "status": "STUDENTS_ONLY",
      "createdAt": "2025-07-20T08:00:00.000Z",
      "updatedAt": "2025-07-20T08:00:00.000Z"
    }
  ]
}
```

**Error Responses**

| Status | Reason           |
|--------|------------------|
| `404`  | Month not found  |

---

### 6. Get Single Lecture *(All users)*

```
GET /lectures/:id
Authorization: Bearer <jwt>  (optional)
```

**Path Params**

| Param | Type   | Description |
|-------|--------|-------------|
| `id`  | string | Lecture ID  |

**Response `200`**

```json
{
  "id": "lec_clxxxxx",
  "monthId": "month_clxxxxx",
  "title": "Introduction to Algebra",
  "description": "Cover chapters 1-3",
  "mode": "ONLINE",
  "platform": "Zoom",
  "startTime": "2025-08-01T10:00:00.000Z",
  "endTime": "2025-08-01T12:00:00.000Z",
  "sessionLink": "https://zoom.us/j/123456789",
  "meetingId": "123 456 789",
  "meetingPassword": "abc123",
  "maxParticipants": 100,
  "status": "STUDENTS_ONLY",
  "createdAt": "2025-07-20T08:00:00.000Z",
  "updatedAt": "2025-07-20T08:00:00.000Z",
  "month": {
    "id": "month_clxxxxx",
    "name": "August 2025",
    "year": 2025,
    "month": 8,
    "class": {
      "id": "class_clxxxxx",
      "name": "Grade 10 Maths",
      "subject": "Mathematics"
    }
  }
}
```

**Error Responses**

| Status | Reason            |
|--------|-------------------|
| `404`  | Lecture not found |

---

## Summary Table

| Method   | Endpoint                     | Auth         | Description                        |
|----------|------------------------------|--------------|------------------------------------|
| `POST`   | `/lectures/month/:monthId`   | Admin JWT    | Create a lecture                   |
| `PATCH`  | `/lectures/:id`              | Admin JWT    | Update a lecture                   |
| `DELETE` | `/lectures/:id`              | Admin JWT    | Delete a lecture                   |
| `GET`    | `/lectures`                  | Admin JWT    | List all lectures (paginated)      |
| `GET`    | `/lectures/month/:monthId`   | Optional JWT | Get month lectures (role-filtered) |
| `GET`    | `/lectures/:id`              | Optional JWT | Get single lecture                 |
