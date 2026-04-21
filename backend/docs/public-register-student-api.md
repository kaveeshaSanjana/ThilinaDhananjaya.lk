# Public Student Registration API

## Overview

This endpoint creates a **new public student user** without authentication.

### Endpoint Details

- **Route**: `POST /api/public/register-student`
- **Full URL**: `https://thilinadhananjayalk-825437021775.us-central1.run.app/api/public/register-student`
- **Bulk route**: `POST /api/public/register-students/bulk`
- **Bulk Full URL**: `https://thilinadhananjayalk-825437021775.us-central1.run.app/api/public/register-students/bulk`
- **Auth**: `None` (public)
- **Controller**: `backend/src/public/public.controller.ts`
- **Service flow**: `backend/src/users/users.service.ts#create`
- **DB tables**: `User` + `Profile` (+ optional `Enrollment` when `classId` is provided)

## What It Does Internally

1. Validates body using `class-validator` rules in `PublicRegisterDto`.
2. Hashes the incoming plaintext password using `bcrypt.hash(password, 12)`.
3. Calls `UsersService.create(...)`.
4. `UsersService.create(...)`:
   - Checks unique email.
   - Checks unique institute user ID (`profile.instituteId`) if provided.
   - Checks unique barcode ID (`profile.barcodeId`) if provided.
   - Creates `User` row with role `STUDENT`.
   - Creates linked `Profile` row with student details including all 4 contact numbers.
5. If `classId` is provided:
  - Verifies class exists.
  - Auto-enrolls the created student into that class.
  - If `paymentType` / `customMonthlyFee` are provided, those class fee settings are applied.
6. Returns created student data (without password) and optional enrollment payload.

---

## Contact Numbers Explanation

The API supports **3 contact phone numbers** for student communications:

| Field | Purpose | Example |
|-------|---------|----------|
| `phone` | **Student Mobile/Telephone** - Primary contact for the student | `0771234567` |
| `guardianPhone` | **Guardian/Parent Mobile/Telephone** - Primary emergency contact | `0719876543` |
| `emergencyContactPhone` | **Emergency Contact** - Secondary emergency contact (relative/alternate) | `0712345678` |

All 3 numbers are **optional** but recommended for complete contact information. Each number is indexed in the database for fast lookups.

## Headers

Optional header:

- `x-institute-id: <orgId>`

If both are provided, `orgId` from body has higher priority than header:

- `body.orgId || header.x-institute-id`

## Quick Start - cURL Example

```bash
curl -X POST https://thilinadhananjayalk-825437021775.us-central1.run.app/api/public/register-student \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "Pass@12345",
    "fullName": "Student Name",
    "barcodeId": "BC-2026-0001",
    "instituteUserId": "PUB-2026-0001",
    "phone": "0771234567",
    "guardianPhone": "0719876543",
    "emergencyContactPhone": "0712345678",
    "emergencyContactName": "Emergency Contact",
    "gender": "MALE",
    "dateOfBirth": "2007-05-15"
  }'
```

## Auto-Assign to Institute & Class

You can **automatically assign students to an institute and class** by including `orgId` and `classId` in the request:

```bash
curl -X POST https://thilinadhananjayalk-825437021775.us-central1.run.app/api/public/register-student \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "Pass@12345",
    "fullName": "Student Name",
    "barcodeId": "BC-2026-0001",
    "instituteUserId": "PUB-2026-0001",
    "phone": "0771234567",
    "guardianPhone": "0719876543",
    "emergencyContactPhone": "0712345678",
    "emergencyContactName": "Emergency Contact",
    "gender": "MALE",
    "orgId": "institute-uuid-here",
    "classId": "class-uuid-here",
    "paymentType": "HALF",
    "customMonthlyFee": 2750
  }'
```

**What happens when you include these fields:**

- **`orgId`** (Institute ID): Automatically assigns the student to this institute
- **`classId`** (Class ID): Automatically enrolls the student in this class
- **`paymentType`** (optional): Sets the payment type for class enrollment (`FULL`, `HALF`, `FREE`)
- **`customMonthlyFee`** (optional): Overrides the default class monthly fee

The response will include both the created student and enrollment details.

## Request Body (All Supported Fields)

```json
{
  "email": "student@example.com",
  "password": "Pass@12345",
  "fullName": "Student Name",
  "instituteUserId": "PUB-2026-0001",
  "instituteId": "PUB-2026-0001",
  "barcodeId": "BC-2026-0001",
  "phone": "0771234567",
  "guardianPhone": "0719876543",
  "emergencyContactPhone": "0712345678",
  "emergencyContactName": "Emergency Contact Name",
  "address": "No. 123, Main Street",
  "school": "Royal College",
  "dateOfBirth": "2007-05-15",
  "guardianName": "Parent Name",
  "relationship": "Parent",
  "occupation": "Student",
  "avatarUrl": "https://example.com/avatar.jpg",
  "gender": "MALE",
  "orgId": "institute-uuid",
  "classId": "class-uuid",
  "paymentType": "HALF",
  "customMonthlyFee": 2750
}
```

## Validation Rules

Required:

- `email` (valid email)
- `password` (string, min length 6)
- `fullName` (non-empty string)
- `barcodeId` (non-empty string)
- `instituteUserId` is required only when `instituteId` is not provided

Optional:

- `instituteId` (acts as alias/fallback for institute user ID)
- **Contact Numbers (3 options)**:
  - `phone` (student mobile/telephone)
  - `guardianPhone` (guardian/parent phone)
  - `emergencyContactPhone` (emergency contact number)
- `emergencyContactName` (emergency contact person name) — used with `emergencyContactPhone`
- `address`, `school`
- `dateOfBirth` (`YYYY-MM-DD` / ISO date string)
- `guardianName`, `relationship`, `occupation`
- `avatarUrl`
- `gender` (`MALE`, `FEMALE`, `OTHER`)
- `orgId`
- `classId` (if provided, newly created student is automatically enrolled to this class)
- `paymentType` (`FULL`, `HALF`, `FREE`) — optional, used only when `classId` is provided
- `customMonthlyFee` (non-negative number) — optional, used only when `classId` is provided

## Success Response (`201 Created`)

```json
{
  "message": "Student registered successfully",
  "student": {
    "id": "uuid",
    "email": "student@example.com",
    "instituteId": null,
    "instituteUserId": "PUB-2026-0001",
    "barcodeId": "BC-2026-0001",
    "fullName": "Student Name",
    "avatarUrl": "https://example.com/avatar.jpg",
    "phone": "0771234567",
    "guardianPhone": "0719876543",
    "emergencyContactPhone": "0712345678",
    "emergencyContactName": "Emergency Contact Name",
    "school": "Royal College",
    "address": "No. 123, Main Street",
    "occupation": "Student",
    "gender": "MALE",
    "dateOfBirth": "2007-05-15T00:00:00.000Z",
    "guardianName": "Parent Name",
    "relationship": "Parent",
    "status": "PENDING",
    "enrolledDate": "2026-04-19T09:00:00.000Z",
    "createdAt": "2026-04-19T09:00:00.000Z"
  },
  "enrollment": {
    "id": "uuid",
    "classId": "class-uuid",
    "paymentType": "HALF",
    "customMonthlyFee": 2750,
    "defaultMonthlyFee": 3500,
    "effectiveMonthlyFee": 2750,
    "hasCustomMonthlyFee": true,
    "class": {
      "id": "class-uuid",
      "name": "Grade 10 Maths",
      "subject": "Mathematics",
      "monthlyFee": 3500
    },
    "createdAt": "2026-04-19T09:00:00.000Z",
    "updatedAt": "2026-04-19T09:00:00.000Z"
  }
}
```

If `classId` is not provided, `enrollment` is returned as `null`.

`paymentType` and `customMonthlyFee` are optional. If omitted, class default fee rules are used.

## Error Cases

### `400 Bad Request`

Validation errors such as:

- Missing `password`
- Password too short
- Invalid `email`
- Missing `fullName`
- Missing `barcodeId`
- Missing both `instituteUserId` and `instituteId`
- Invalid `dateOfBirth`
- Invalid `gender`
- Invalid `paymentType`
- Invalid `customMonthlyFee`

### `409 Conflict`

From `UsersService.create(...)`:

- `Email already registered`
- `Institute user ID already exists`
- `Barcode ID already exists`

### `404 Not Found`

- `Class not found: <classId>` (when `classId` is provided but does not exist)

### `500 Internal Server Error`

Unexpected DB/app errors.

---

## Bulk Student Creation API

### Endpoint

```http
POST /api/public/register-students/bulk
Content-Type: application/json
```

### Request Body

```json
{
  "students": [
    {
      "email": "student1@example.com",
      "password": "Pass@12345",
      "fullName": "Student One",
      "instituteUserId": "PUB-2026-0001",
      "barcodeId": "BC-2026-0001",
      "classId": "class-uuid",
      "paymentType": "FULL"
    },
    {
      "email": "student2@example.com",
      "password": "Pass@12345",
      "fullName": "Student Two",
      "instituteUserId": "PUB-2026-0002",
      "barcodeId": "BC-2026-0002",
      "classId": "class-uuid",
      "customMonthlyFee": 3000
    }
  ]
}
```

### Bulk Success Response (`200 OK`)

```json
{
  "message": "Bulk student registration processed",
  "summary": {
    "totalRecords": 2,
    "successCount": 1,
    "failedCount": 1
  },
  "successful": [
    {
      "index": 1,
      "status": "SUCCESS",
      "email": "student1@example.com",
      "studentId": "user_uuid_1",
      "instituteUserId": "PUB-2026-0001",
      "classId": "class-uuid",
      "enrollmentStatus": "ENROLLED",
      "student": { "id": "user_uuid_1" },
      "enrollment": { "id": "enr_uuid_1", "paymentType": "FULL" }
    }
  ],
  "failed": [
    {
      "index": 2,
      "status": "FAILED",
      "email": "student2@example.com",
      "instituteUserId": "PUB-2026-0002",
      "classId": "class-uuid",
      "reason": "Class not found: class-uuid"
    }
  ]
}
```

This response includes count fields and per-row status details.

## Password Handling

- Incoming password is plaintext in request body.
- Backend hashes password with bcrypt (rounds = 12) before storing.
- Password is **not returned** in API response.

## Real Smoke Test (Executed)

Executed on `2026-04-19` against local backend runtime.

Request target:

- `POST http://localhost:3001/api/public/register-student`

Test payload included all major fields, including password and profile fields.

Observed result:

- API returned success message and created student object.
- DB verification confirmed:
  - User exists with role `STUDENT`.
  - `instituteId` and `avatarUrl` are returned in the API response.
  - Stored password is hashed (`isHashed: true`).
  - `bcrypt.compare(plainPassword, storedHash) = true`.
  - Profile fields persisted (`instituteId`, `barcodeId`, `fullName`, phones, address, school, DOB, guardian details, occupation, gender, status).

## Example PowerShell Call

```powershell
$body = @{
  email = "public.student@example.com"
  password = "Pass@12345"
  fullName = "Public Student"
  instituteUserId = "PUB-2026-0001"
  barcodeId = "BC-2026-0001"
  phone = "0771234567"
  guardianPhone = "0719876543"
  emergencyContactPhone = "0712345678"
  emergencyContactName = "Emergency Contact"
  address = "123 Test Street"
  school = "Test School"
  dateOfBirth = "2007-05-15"
  guardianName = "Guardian Name"
  relationship = "Parent"
  occupation = "Student"
  avatarUrl = "https://example.com/avatar.jpg"
  gender = "MALE"
  orgId = "institute-uuid"
  classId = "class-uuid"
  paymentType = "HALF"
  customMonthlyFee = 2750
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "https://thilinadhananjayalk-825437021775.us-central1.run.app/api/public/register-student" -ContentType "application/json" -Body $body
```

## Example JavaScript/Axios Call

```javascript
import axios from 'axios';

const API_BASE_URL = 'https://thilinadhananjayalk-825437021775.us-central1.run.app/api';

const registerStudent = async () => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/public/register-student`,
      {
        email: 'student@example.com',
        password: 'Pass@12345',
        fullName: 'Student Name',
        barcodeId: 'BC-2026-0001',
        instituteUserId: 'PUB-2026-0001',
        phone: '0771234567',
        guardianPhone: '0719876543',
        emergencyContactPhone: '0712345678',
        emergencyContactName: 'Emergency Contact',
        address: '123 Test Street',
        school: 'Test School',
        dateOfBirth: '2007-05-15',
        guardianName: 'Guardian Name',
        relationship: 'Parent',
        occupation: 'Student',
        gender: 'MALE',
        avatarUrl: 'https://example.com/avatar.jpg',
        orgId: 'institute-uuid',
        classId: 'class-uuid',
        paymentType: 'HALF',
        customMonthlyFee: 2750
      }
    );
    
    console.log('Student registered:', response.data);
    return response.data;
  } catch (error) {
    console.error('Registration failed:', error.response?.data || error.message);
    throw error;
  }
};

// Call the function
registerStudent();
```

## Example React Hook/Service

```typescript
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

interface StudentRegistrationData {
  email: string;
  password: string;
  fullName: string;
  barcodeId: string;
  instituteUserId: string;
  // ─── Contact Numbers ───
  phone?: string;
  guardianPhone?: string;
  emergencyContactPhone?: string;
  emergencyContactName?: string;
  // ──────────────────────
  address?: string;
  school?: string;
  dateOfBirth?: string;
  guardianName?: string;
  relationship?: string;
  occupation?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  avatarUrl?: string;
  classId?: string;
  paymentType?: 'FULL' | 'HALF' | 'FREE';
  customMonthlyFee?: number;
  orgId?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  'https://thilinadhananjayalk-825437021775.us-central1.run.app/api';

export const useRegisterStudent = () => {
  return useMutation({
    mutationFn: async (data: StudentRegistrationData) => {
      const response = await axios.post(
        `${API_BASE_URL}/public/register-student`,
        data
      );
      return response.data;
    },
  });
};

// Usage in component
const MyComponent = () => {
  const { mutate: registerStudent, isPending } = useRegisterStudent();
  
  const handleSubmit = (formData: StudentRegistrationData) => {
    registerStudent(formData, {
      onSuccess: (data) => {
        console.log('Success:', data);
        // Handle success (redirect, show message, etc.)
      },
      onError: (error) => {
        console.error('Error:', error);
        // Handle error
      }
    });
  };
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      // collect form data and call handleSubmit
    }}>
      {/* Form fields */}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
};
```

## Auto-Assign to Institute & Class Example

```typescript
// Register student and auto-assign to institute and class with all 4 contact numbers
const handleRegisterWithInstituteAndClass = () => {
  const { mutate: registerStudent } = useRegisterStudent();
  
  registerStudent({
    email: 'student@example.com',
    password: 'Pass@12345',
    fullName: 'Student Name',
    barcodeId: 'BC-2026-0001',
    instituteUserId: 'PUB-2026-0001',
    phone: '0771234567',           // Student phone
    guardianPhone: '0719876543',   // Guardian/Parent phone
    emergencyContactPhone: '0712345678',  // Emergency contact phone
    emergencyContactName: 'Emergency Contact Name', // Emergency contact person
    gender: 'MALE',
    orgId: '550e8400-e29b-41d4-a716-446655440000', // Institute UUID
    classId: '660f9511-f40c-52e5-b827-557766551111', // Class UUID
    paymentType: 'HALF',
    customMonthlyFee: 2750
  }, {
    onSuccess: (data) => {
      console.log('Student registered and assigned to institute and class:', data);
      // Student now belongs to the institute and is enrolled in the class
    },
    onError: (error) => {
      console.error('Registration failed:', error);
    }
  });
};
```
