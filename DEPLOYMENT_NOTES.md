# Student Contact Enhancement - Deployment Notes

## Summary of Changes

### Database Schema Updates ✅
- **Removed**: `whatsappPhone` field from Profile table
- **Added**: `emergencyContactPhone` and `emergencyContactName` fields
- **Final Contact Fields** (3 total):
  - `phone` - Student mobile/telephone
  - `guardianPhone` - Guardian/Parent mobile/telephone  
  - `emergencyContactPhone` - Emergency contact (secondary)

### Backend API Updates ✅

#### 1. **Prisma Schema** (`backend/prisma/schema.prisma`)
   - Updated Profile model with new contact fields
   - Added indexes for phone lookup

#### 2. **Migration File** (`backend/prisma/migrations/20260421000000_add_emergency_contact/migration.sql`)
   - Created migration to add emergency contact fields
   - Added database indexes

#### 3. **Public Controller** (`backend/src/public/public.controller.ts`)
   - Updated `PublicRegisterDto` - removed `whatsappPhone`, added `emergencyContactPhone` & `emergencyContactName`
   - Updated `formatPublicStudentPayload()` - returns new emergency contact fields
   - Updated `registerSinglePublicStudent()` - passes new fields to service

#### 4. **Users Service** (`backend/src/users/users.service.ts`)
   - Updated `CreateUserData` interface - removed `whatsappPhone`, added new fields
   - Updated `create()` method - saves new contact fields to database

### API Documentation Updates ✅
- Updated [public-register-student-api.md](backend/docs/public-register-student-api.md) with:
  - All 3 contact number fields in request/response examples
  - Updated cURL examples
  - Updated PowerShell examples
  - Updated JavaScript/Axios examples
  - Updated React Hook examples
  - Updated validation rules
  - Contact numbers explanation table

---

## Deployment Steps

### Step 1: Set Up Environment Variables
Create a `.env` file in the `backend/` directory:

```bash
# .env
DATABASE_URL=mysql://user:password@localhost:3306/database_name
NODE_ENV=production
JWT_SECRET=your_secret_key
FRONTEND_URL=http://localhost:3000
AWS_REGION=us-central1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=your_bucket
```

### Step 2: Run Prisma Migration

```bash
cd backend
npx prisma migrate deploy
```

Or if you're using Docker:

```bash
docker-compose exec backend npx prisma migrate deploy
```

### Step 3: Build Backend (if using Docker)

```bash
docker-compose build backend
docker-compose up backend
```

### Step 4: Test the API

**Simple Test - Register Student with Emergency Contact:**

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
    "emergencyContactName": "Emergency Contact Name",
    "gender": "MALE"
  }'
```

---

## API Changes Summary

### Request Body - Old vs New

**REMOVED:**
```json
"whatsappPhone": "0771234567"
```

**ADDED:**
```json
"emergencyContactPhone": "0712345678",
"emergencyContactName": "Emergency Contact Name"
```

### Response Format

**New Response includes:**
```json
{
  "phone": "0771234567",
  "guardianPhone": "0719876543",
  "emergencyContactPhone": "0712345678",
  "emergencyContactName": "Emergency Contact Name"
}
```

---

## Database Changes

### Migration Applied:
- `ALTER TABLE Profile ADD COLUMN emergencyContactPhone VARCHAR(20)`
- `ALTER TABLE Profile ADD COLUMN emergencyContactName VARCHAR(255)`
- `ALTER TABLE Profile DROP COLUMN whatsappPhone` (if exists)
- Created indexes on all contact phone fields

### Indexed Fields:
- `phone`
- `guardianPhone`
- `emergencyContactPhone`

---

## Files Modified

```
backend/
  ├── prisma/
  │   ├── schema.prisma ✅
  │   └── migrations/20260421000000_add_emergency_contact/ ✅
  └── src/
      ├── public/public.controller.ts ✅
      └── users/users.service.ts ✅

backend/docs/
  └── public-register-student-api.md ✅
```

---

## Rollback Instructions (if needed)

If you need to rollback, use:

```bash
npx prisma migrate resolve --rolled-back 20260421000000_add_emergency_contact
```

---

## Testing Checklist

- [ ] Migration runs without errors
- [ ] Register student with all 3 phone numbers
- [ ] Register student with minimal fields (only required)
- [ ] Verify emergency contact saved in database
- [ ] Test bulk registration with new fields
- [ ] Verify API response includes new fields
- [ ] Test with missing emergency contact fields (should be optional)

---

**Deployment Date**: April 21, 2026  
**Status**: Ready for Testing
