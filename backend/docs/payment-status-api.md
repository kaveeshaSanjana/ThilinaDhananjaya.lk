# Payment Status API — Frontend Integration Guide

Base URL: `http://localhost:3001/api`

All endpoints require an `ADMIN` JWT token unless stated otherwise.

```
Authorization: Bearer <adminAccessToken>
```

---

## Payment Status Values

| Status | Meaning |
|---|---|
| `PAID` | Payment slip submitted and verified by admin |
| `LATE` | Payment received but marked as late |
| `PENDING` | Slip submitted, waiting for admin review |
| `UNPAID` | No slip submitted, or all slips were rejected |

---

## Endpoints

### 1. Get Class Month Payment Overview

> Returns every enrolled student for a class+month with their current payment status, plus a summary count.

**`GET /api/payments/class/:classId/month/:monthId`**

| | |
|---|---|
| Auth | JWT — `ADMIN` only |
| URL params | `classId` — class UUID, `monthId` — month UUID |

**Response `200`**
```json
{
  "class": {
    "id": "abc-123",
    "name": "Physics Class",
    "subject": "Physics"
  },
  "month": {
    "id": "month-456",
    "name": "April 2026",
    "year": 2026,
    "month": 4
  },
  "summary": {
    "total": 30,
    "paid": 18,
    "late": 3,
    "pending": 5,
    "unpaid": 4
  },
  "students": [
    {
      "userId": "user-001",
      "email": "kamal@example.com",
      "profile": {
        "fullName": "Kamal Perera",
        "instituteId": "TD-2026-0001",
        "avatarUrl": "https://bucket.s3.amazonaws.com/avatars/uuid.jpg",
        "phone": "0771234567"
      },
      "paymentStatus": "PAID",
      "slip": {
        "id": "slip-001",
        "status": "VERIFIED",
        "type": "MONTHLY",
        "slipUrl": "https://bucket.s3.amazonaws.com/...",
        "adminNote": null,
        "createdAt": "2026-04-01T10:00:00.000Z"
      }
    },
    {
      "userId": "user-002",
      "email": "nimal@example.com",
      "profile": {
        "fullName": "Nimal Silva",
        "instituteId": "TD-2026-0002",
        "avatarUrl": null,
        "phone": "0777654321"
      },
      "paymentStatus": "UNPAID",
      "slip": null
    }
  ]
}
```

**Fetch example**
```js
async function getClassMonthPayments(classId, monthId, accessToken) {
  const res = await fetch(`/api/payments/class/${classId}/month/${monthId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

**Axios example**
```js
export async function getClassMonthPayments(classId, monthId) {
  const { data } = await api.get(`/payments/class/${classId}/month/${monthId}`);
  return data;
  // data.summary → { total, paid, late, pending, unpaid }
  // data.students → array with paymentStatus per student
}
```

---

### 2. Manually Set Student Payment Status

> Admin sets a student's payment status for a specific month to `PAID`, `LATE`, or `UNPAID`.
> - `PAID` — marks existing slip as `VERIFIED`, or creates a manual record
> - `LATE` — marks existing slip as `LATE`, or creates a manual record
> - `UNPAID` — rejects all existing slips for that student+month

**`PATCH /api/payments/student/:userId/month/:monthId/status`**

| | |
|---|---|
| Auth | JWT — `ADMIN` only |
| Content-Type | `application/json` |
| URL params | `userId` — user UUID, `monthId` — month UUID |

**Request body**
```json
{
  "status": "PAID",
  "adminNote": "Cash paid in person on 01/04/2026"
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `status` | string | ✅ | `PAID`, `LATE`, `UNPAID` |
| `adminNote` | string | ❌ | Any note for the record |

**Response `200` — when marking PAID or LATE**
```json
{
  "paymentStatus": "PAID",
  "slip": {
    "id": "slip-001",
    "status": "VERIFIED",
    "type": "MONTHLY",
    "slipUrl": "MANUAL_ENTRY",
    "adminNote": "Cash paid in person on 01/04/2026",
    "month": {
      "id": "month-456",
      "name": "April 2026",
      "class": { "id": "abc-123", "name": "Physics Class" }
    }
  }
}
```

**Response `200` — when marking UNPAID**
```json
{
  "userId": "user-001",
  "monthId": "month-456",
  "paymentStatus": "UNPAID",
  "message": "Student marked as unpaid. All existing slips rejected."
}
```

**Fetch example**
```js
async function setStudentPaymentStatus(userId, monthId, status, adminNote, accessToken) {
  const res = await fetch(`/api/payments/student/${userId}/month/${monthId}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status, adminNote }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Usage
await setStudentPaymentStatus(userId, monthId, 'PAID', 'Cash received', token);
await setStudentPaymentStatus(userId, monthId, 'LATE', 'Paid 5 days late', token);
await setStudentPaymentStatus(userId, monthId, 'UNPAID', 'No contact', token);
```

**Axios example**
```js
export async function setStudentPaymentStatus(userId, monthId, status, adminNote = '') {
  const { data } = await api.patch(
    `/payments/student/${userId}/month/${monthId}/status`,
    { status, adminNote },
  );
  return data;
}
```

---

### 3. Existing Endpoints (for reference)

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/payments/submit` | JWT (student) | Student submits a payment slip |
| `GET` | `/api/payments/my` | JWT (student) | Student's own payment history |
| `GET` | `/api/payments/pending` | Admin | List all pending slips |
| `GET` | `/api/payments/all` | Admin | All slips, filter by `?status=` or `?monthId=` |
| `PATCH` | `/api/payments/:id/verify` | Admin | Verify a specific slip |
| `PATCH` | `/api/payments/:id/reject` | Admin | Reject a specific slip |
| `GET` | `/api/payments/student/:userId` | Admin | All slips for a student |

---

## React Usage Example — Payment Status Table

```jsx
import { useEffect, useState } from 'react';

const STATUS_COLORS = {
  PAID: 'text-green-600',
  LATE: 'text-yellow-600',
  PENDING: 'text-blue-600',
  UNPAID: 'text-red-600',
};

export function ClassPaymentTable({ classId, monthId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    getClassMonthPayments(classId, monthId).then(setData);
  }, [classId, monthId]);

  const handleStatusChange = async (userId, status) => {
    await setStudentPaymentStatus(userId, monthId, status);
    const updated = await getClassMonthPayments(classId, monthId);
    setData(updated);
  };

  if (!data) return <p>Loading...</p>;

  return (
    <div>
      {/* Summary */}
      <div className="flex gap-4 mb-4">
        <span>Total: {data.summary.total}</span>
        <span className="text-green-600">Paid: {data.summary.paid}</span>
        <span className="text-yellow-600">Late: {data.summary.late}</span>
        <span className="text-blue-600">Pending: {data.summary.pending}</span>
        <span className="text-red-600">Unpaid: {data.summary.unpaid}</span>
      </div>

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Institute ID</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.students.map((s) => (
            <tr key={s.userId}>
              <td>{s.profile?.fullName}</td>
              <td>{s.profile?.instituteId}</td>
              <td className={STATUS_COLORS[s.paymentStatus]}>{s.paymentStatus}</td>
              <td>
                <select
                  defaultValue={s.paymentStatus}
                  onChange={(e) => handleStatusChange(s.userId, e.target.value)}
                >
                  <option value="PAID">Mark Paid</option>
                  <option value="LATE">Mark Late</option>
                  <option value="UNPAID">Mark Unpaid</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Error Responses

| Status | Reason |
|---|---|
| `400 Bad Request` | Invalid `status` value (must be `PAID`, `LATE`, or `UNPAID`) |
| `401 Unauthorized` | Missing or expired JWT token |
| `403 Forbidden` | User is not an `ADMIN` |
| `404 Not Found` | Class, month, or user ID does not exist |

**Example error body**
```json
{
  "statusCode": 404,
  "message": "Month not found for this class",
  "error": "Not Found"
}
```
