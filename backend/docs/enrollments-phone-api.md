# Enrollments & Phone Number API

All endpoints require a **Bearer JWT token** in the `Authorization` header.

---

## Enrollments

### 1. Enroll student by `userId` (Admin)

```
POST /enrollments
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request body**
```json
{
  "userId": "uuid-of-student",
  "classId": "uuid-of-class"
}
```

**Success `201`**
```json
{
  "id": "enrollment-uuid",
  "userId": "uuid-of-student",
  "classId": "uuid-of-class",
  "createdAt": "2026-04-02T00:00:00.000Z",
  "class": { "id": "...", "name": "Physics 2026", "subject": "Physics" }
}
```

**Errors**
| Status | Reason |
|--------|--------|
| `401` | Missing / invalid token |
| `403` | Not an ADMIN |
| `409` | Student already enrolled in this class |

---

### 2. Enroll student by phone number (Admin)

Looks up the student profile by their registered `phone` field and enrolls them.

```
POST /enrollments/by-phone
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request body**
```json
{
  "phone": "0771234567",
  "classId": "uuid-of-class"
}
```

**Success `201`**
```json
{
  "id": "enrollment-uuid",
  "userId": "uuid-of-student",
  "classId": "uuid-of-class",
  "createdAt": "2026-04-02T00:00:00.000Z",
  "class": { "id": "...", "name": "Physics 2026", "subject": "Physics" }
}
```

**Errors**
| Status | Reason |
|--------|--------|
| `401` | Missing / invalid token |
| `403` | Not an ADMIN |
| `404` | No student found with that phone number |
| `409` | Student already enrolled in this class |

---

### 3. Get my enrollments (Student)

```
GET /enrollments/my
Authorization: Bearer <student_token>
```

**Success `200`**
```json
[
  {
    "id": "enrollment-uuid",
    "userId": "...",
    "classId": "...",
    "createdAt": "2026-04-02T00:00:00.000Z",
    "class": { "id": "...", "name": "Physics 2026", "subject": "Physics" }
  }
]
```

---

### 4. Get all enrollments for a class (Admin)

```
GET /enrollments/class/:classId
Authorization: Bearer <admin_token>
```

**Success `200`**
```json
[
  {
    "id": "enrollment-uuid",
    "userId": "...",
    "classId": "...",
    "createdAt": "2026-04-02T00:00:00.000Z",
    "user": {
      "id": "...",
      "email": "student@example.com",
      "profile": {
        "fullName": "John Doe",
        "instituteId": "TD-2026-0001"
      }
    }
  }
]
```

---

### 5. Unenroll a student (Admin)

```
DELETE /enrollments/:userId/:classId
Authorization: Bearer <admin_token>
```

**Success `200`** — returns the deleted enrollment record.

**Errors**
| Status | Reason |
|--------|--------|
| `404` | Enrollment not found |

---

## Student Phone Number

### 6. Update student phone number (Admin)

```
PATCH /users/students/:id/phone
Authorization: Bearer <admin_token>
Content-Type: application/json
```

| Param | Type | Description |
|-------|------|-------------|
| `id` | path | Student's user UUID |

**Request body**
```json
{
  "phone": "0771234567",
  "whatsappPhone": "0771234567"
}
```

> `whatsappPhone` is optional. If omitted, the existing value is not changed.

**Success `200`**
```json
{
  "id": "profile-uuid",
  "userId": "...",
  "phone": "0771234567",
  "whatsappPhone": "0771234567",
  "updatedAt": "2026-04-02T00:00:00.000Z"
}
```

**Errors**
| Status | Reason |
|--------|--------|
| `401` | Missing / invalid token |
| `403` | Not an ADMIN |
| `404` | Student profile not found |

---

## Frontend Integration Notes

- All admin requests must include the JWT token from the login response (`access_token` field).
- To enroll a student quickly from a phone number lookup form, use **endpoint 2** (`POST /enrollments/by-phone`).
- To enroll from a student list (where you already have the `userId`), use **endpoint 1** (`POST /enrollments`).
- Call **endpoint 6** to update the phone number after editing a student's profile form.
