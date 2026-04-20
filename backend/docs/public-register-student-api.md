# Public Student Registration API

## Overview

This endpoint creates a **new public student user** without authentication.

- Route: `POST /api/public/register-student`
- Auth: `None` (public)
- Controller: `backend/src/public/public.controller.ts`
- Service flow: `backend/src/users/users.service.ts#create`
- DB tables: `User` + `Profile` (+ optional `Enrollment` when `classId` is provided)

## What It Does Internally

1. Validates body using `class-validator` rules in `PublicRegisterDto`.
2. Hashes the incoming plaintext password using `bcrypt.hash(password, 12)`.
3. Calls `UsersService.create(...)`.
4. `UsersService.create(...)`:
   - Checks unique email.
   - Checks unique institute user ID (`profile.instituteId`) if provided.
   - Checks unique barcode ID (`profile.barcodeId`) if provided.
   - Creates `User` row with role `STUDENT`.
   - Creates linked `Profile` row with student details.
5. If `classId` is provided:
  - Verifies class exists.
  - Auto-enrolls the created student into that class.
6. Returns created student data (without password) and optional enrollment payload.

## Headers

Optional header:

- `x-institute-id: <orgId>`

If both are provided, `orgId` from body has higher priority than header:

- `body.orgId || header.x-institute-id`

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
  "whatsappPhone": "0771234567",
  "address": "No. 123, Main Street",
  "school": "Royal College",
  "dateOfBirth": "2007-05-15",
  "guardianName": "Parent Name",
  "guardianPhone": "0719876543",
  "relationship": "Parent",
  "occupation": "Student",
  "avatarUrl": "https://example.com/avatar.jpg",
  "gender": "MALE",
  "orgId": "institute-uuid",
  "classId": "class-uuid"
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
- `phone`, `whatsappPhone`, `address`, `school`
- `dateOfBirth` (`YYYY-MM-DD` / ISO date string)
- `guardianName`, `guardianPhone`, `relationship`, `occupation`
- `avatarUrl`
- `gender` (`MALE`, `FEMALE`, `OTHER`)
- `orgId`
- `classId` (if provided, newly created student is automatically enrolled to this class)

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
    "whatsappPhone": "0771234567",
    "school": "Royal College",
    "address": "No. 123, Main Street",
    "occupation": "Student",
    "gender": "MALE",
    "dateOfBirth": "2007-05-15T00:00:00.000Z",
    "guardianName": "Parent Name",
    "guardianPhone": "0719876543",
    "relationship": "Parent",
    "status": "PENDING",
    "enrolledDate": "2026-04-19T09:00:00.000Z",
    "createdAt": "2026-04-19T09:00:00.000Z"
  },
  "enrollment": {
    "id": "uuid",
    "classId": "class-uuid",
    "paymentType": "FULL",
    "customMonthlyFee": null,
    "defaultMonthlyFee": 3500,
    "effectiveMonthlyFee": 3500,
    "hasCustomMonthlyFee": false,
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

### `409 Conflict`

From `UsersService.create(...)`:

- `Email already registered`
- `Institute user ID already exists`
- `Barcode ID already exists`

### `404 Not Found`

- `Class not found: <classId>` (when `classId` is provided but does not exist)

### `500 Internal Server Error`

Unexpected DB/app errors.

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
  whatsappPhone = "0771234567"
  address = "123 Test Street"
  school = "Test School"
  dateOfBirth = "2007-05-15"
  guardianName = "Guardian Name"
  guardianPhone = "0719876543"
  relationship = "Parent"
  occupation = "Student"
  avatarUrl = "https://example.com/avatar.jpg"
  gender = "MALE"
  classId = "class-uuid"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/public/register-student" -ContentType "application/json" -Body $body
```
