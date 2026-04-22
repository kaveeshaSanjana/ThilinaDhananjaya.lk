# ThilinaDhananjaya LMS - Attendance APIs

Complete documentation for all attendance-related APIs in the ThilinaDhananjaya Learning Management System.

## Production Environment

**Backend URL:** `https://api.thilinadhananjaya.lk`

**Frontend URL:** `https://thilinadhananjaya.lk`

**Database:** MySQL 8.0

**Port:** 3001 (development), 443 (production with SSL)

**Deployment:** Docker Compose with Nginx reverse proxy

**SSL:** Let's Encrypt certificates (configured in nginx/certs/)

**Rate Limiting:** 30 requests/minute for API endpoints

**Health Checks:** Database connectivity monitoring

## Environment Variables

### Required
- `DATABASE_URL`: MySQL connection string
- `JWT_SECRET`: JWT signing secret
- `JWT_REFRESH_SECRET`: Refresh token signing secret
- `MYSQL_ROOT_PASSWORD`: Database root password
- `MYSQL_DATABASE`: Database name
- `MYSQL_USER`: Database user
- `MYSQL_PASSWORD`: Database password

### Optional
- `PORT`: Server port (default: 3001)
- `FRONTEND_URL`: CORS allowed origins
- `JWT_ACCESS_EXPIRES_IN`: Access token expiry (default: 15m)
- `JWT_REFRESH_EXPIRES_IN`: Refresh token expiry (default: 7d)
- `ATTENDANCE_PUSH_DURATION_SECONDS`: Recording attendance threshold (default: 60)
- `INSTITUTE_ID_PREFIX`: Student ID prefix (default: TD)
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`: S3 configuration

## Development Environment

**Backend URL:** `http://localhost:3001`

**Frontend URL:** `http://localhost:8080`

**Database:** MySQL (local or remote)

## Complete Attendance API Documentation

### 📋 All Attendance-Related API Files

1. **[README.md](README.md)** - This overview document
2. **[Public Attendance Import API](public-attendance-import-api.md)** - External system integration
3. **[Class Attendance Management API](class-attendance-management-api.md)** - Admin session management
4. **[Student Class Attendance API](student-class-attendance-api.md)** - Student attendance viewing
5. **[Student Month Recording Attendance API](student-month-attendance-api.md)** - Monthly recording attendance
6. **[Recording Attendance Multi API](recording-attendance-multi-api.md)** - Multi-recording queries
7. **[Get Attendance by Class API](attendance-by-class-api.md)** - Class-wide recording attendance
8. **[Attendance API](attendance-api.md)** - Core attendance operations

### 🔧 Key Features Implemented

- ✅ **Check-in/Check-out Times**: Full support for `checkInAt` and `checkOutAt` timestamps
- ✅ **Session Management**: Complete session lifecycle management
- ✅ **Bulk Operations**: Efficient bulk import and processing
- ✅ **Multi-format Support**: Barcode, institute ID, and manual marking
- ✅ **Real-time Updates**: Live attendance tracking and updates
- ✅ **Comprehensive Validation**: Input validation and error handling
- ✅ **Production Ready**: SSL, rate limiting, and monitoring configured

## Authentication

### JWT Tokens
- **Access Token:** 15 minutes expiry
- **Refresh Token:** 7 days expiry
- Header: `Authorization: Bearer <token>`

### Admin Endpoints
Require admin role authentication.

### Student Endpoints
Require student authentication.

### Public Endpoints
No authentication required (for external integrations).

## Data Models

### Attendance Status Values
- `PRESENT` - Student was on time
- `LATE` - Student arrived late
- `ABSENT` - Student was absent
- `EXCUSED` - Absence was excused
- `NOTMARKED` - Not marked (normalized to ABSENT)

### Attendance Methods
- `barcode` - Marked via barcode scanning
- `institute_id` - Marked via institute ID
- `manual` - Manually marked by admin
- `phone` - Marked via phone API
- `bulk` - Imported via bulk API
- `public_import_barcode` - Public barcode import
- `public_import_institute_id` - Public institute ID import

## Key Features

### ✅ Check-in/Check-out Times
- `checkInAt`: ISO datetime when student checked in
- `checkOutAt`: ISO datetime when student checked out
- Available in all attendance import and retrieval APIs

### ✅ Session Management
- Session-based attendance tracking
- Support for session codes and custom identifiers
- Session time ranges (start time only, end time managed separately)

### ✅ Bulk Operations
- Bulk import of attendance records
- Bulk session management
- Comprehensive error reporting for failed records

### ✅ Real-time Updates
- Live attendance marking
- Automatic session closure
- Push notifications for attendance events

## Database Schema

### Core Tables
- `ClassAttendance` - Individual attendance records
- `ClassAttendanceSession` - Session definitions
- `ClassAttendanceWeek` - Weekly groupings
- `User` - Students and admins
- `Class` - Class definitions

### Key Relationships
- Attendance → User (many-to-one)
- Attendance → Class (many-to-one)
- Session → Class (many-to-one)
- Session → Week (many-to-one)

## Error Handling

### Common HTTP Status Codes
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

### Validation Rules
- Session must exist before marking attendance
- Student must be enrolled in the class
- Date/session time validation
- Status value validation
- Duplicate prevention (upsert behavior)

## Rate Limiting

- Public endpoints: 100 requests per minute per IP
- Authenticated endpoints: 1000 requests per minute per user
- Bulk endpoints: 10 requests per minute per user

## Monitoring

- All attendance operations are logged
- Real-time metrics available via admin dashboard
- Error tracking and alerting configured

## Support

For API integration questions or issues:
- Check the detailed documentation in each API file
- Review the example requests and responses
- Test with the development environment first
- Contact the development team for production access