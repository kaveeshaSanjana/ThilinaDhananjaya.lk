# Image Upload API — Frontend Integration Guide

Base URL: `http://localhost:3001/api`

All upload endpoints accept `multipart/form-data`. The file field name is always **`file`**.  
Maximum file size: **5 MB**. Allowed mime types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.

---

## Authentication

All upload endpoints require a JWT access token in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

Admin-only endpoints additionally require the user's role to be `ADMIN`.

---

## Endpoints

### 1. Generic Image Upload

> Upload any image and get back a URL. Use this when you want to upload first and then attach the URL to a create/update request.

**`POST /api/upload/image`**

| | |
|---|---|
| Auth | JWT (any role) |
| Content-Type | `multipart/form-data` |
| Query param | `folder` — one of `classes`, `recordings`, `avatars`, `general` (default: `general`) |

**Request**
```
POST /api/upload/image?folder=classes
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <image file>
```

**Response `200`**
```json
{
  "url": "https://your-bucket.s3.us-east-1.amazonaws.com/classes/uuid.jpg"
}
```

**JavaScript / Fetch example**
```js
async function uploadImage(file, folder = 'general', accessToken) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`/api/upload/image?folder=${folder}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { url: string }
}
```

---

### 2. Class Thumbnail Upload

> Upload a thumbnail directly to a class. The class record is updated automatically — no separate PATCH needed.

**`POST /api/classes/:id/thumbnail`**

| | |
|---|---|
| Auth | JWT — `ADMIN` only |
| Content-Type | `multipart/form-data` |
| URL param | `id` — class UUID |

**Request**
```
POST /api/classes/abc-123/thumbnail
Authorization: Bearer <adminToken>
Content-Type: multipart/form-data

file: <image file>
```

**Response `200`**
```json
{
  "thumbnail": "https://your-bucket.s3.us-east-1.amazonaws.com/classes/uuid.jpg"
}
```

**JavaScript / Fetch example**
```js
async function uploadClassThumbnail(classId, file, accessToken) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`/api/classes/${classId}/thumbnail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { thumbnail: string }
}
```

**React + input example**
```jsx
function ClassThumbnailUpload({ classId, accessToken }) {
  const handleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { thumbnail } = await uploadClassThumbnail(classId, file, accessToken);
    console.log('New thumbnail URL:', thumbnail);
  };

  return <input type="file" accept="image/*" onChange={handleChange} />;
}
```

---

### 3. Recording Thumbnail Upload

> Upload a thumbnail directly to a recording. The recording is updated automatically.

**`POST /api/recordings/:id/thumbnail`**

| | |
|---|---|
| Auth | JWT — `ADMIN` only |
| Content-Type | `multipart/form-data` |
| URL param | `id` — recording UUID |

**Request**
```
POST /api/recordings/xyz-456/thumbnail
Authorization: Bearer <adminToken>
Content-Type: multipart/form-data

file: <image file>
```

**Response `200`**
```json
{
  "thumbnail": "https://your-bucket.s3.us-east-1.amazonaws.com/recordings/uuid.png"
}
```

**JavaScript / Fetch example**
```js
async function uploadRecordingThumbnail(recordingId, file, accessToken) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`/api/recordings/${recordingId}/thumbnail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { thumbnail: string }
}
```

---

### 4. Student Avatar Upload

> Upload a profile picture for a student. The student profile is updated automatically.

**`POST /api/users/students/:id/avatar`**

| | |
|---|---|
| Auth | JWT — `ADMIN` only |
| Content-Type | `multipart/form-data` |
| URL param | `id` — user UUID |

**Request**
```
POST /api/users/students/user-789/avatar
Authorization: Bearer <adminToken>
Content-Type: multipart/form-data

file: <image file>
```

**Response `200`**
```json
{
  "avatarUrl": "https://your-bucket.s3.us-east-1.amazonaws.com/avatars/uuid.jpg"
}
```

**JavaScript / Fetch example**
```js
async function uploadStudentAvatar(userId, file, accessToken) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`/api/users/students/${userId}/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { avatarUrl: string }
}
```

---

### 5. Register with Avatar (optional)

> Students can optionally include an `avatarUrl` when registering. Upload the image first using the generic endpoint, then pass the returned URL in the register body.

**`POST /api/auth/register`** — `Content-Type: application/json`

```json
{
  "email": "student@example.com",
  "password": "secret123",
  "fullName": "Kamal Perera",
  "phone": "0771234567",
  "avatarUrl": "https://your-bucket.s3.us-east-1.amazonaws.com/avatars/uuid.jpg"
}
```

**Two-step flow example**
```js
// Step 1: upload image
const { url } = await uploadImage(file, 'avatars', tempToken);

// Step 2: register with the URL
const res = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, fullName, avatarUrl: url }),
});
```

---

### 6. Create Student with Avatar (Admin)

> Admin creates a student and optionally provides an `avatarUrl`.

**`POST /api/users/students`** — `Content-Type: application/json`

```json
{
  "email": "student@example.com",
  "password": "secret123",
  "fullName": "Kamal Perera",
  "school": "Rahula College",
  "avatarUrl": "https://your-bucket.s3.us-east-1.amazonaws.com/avatars/uuid.jpg"
}
```

---

## Error Responses

| Status | Reason |
|---|---|
| `400 Bad Request` | Invalid file type, file exceeds 5 MB limit, or missing `file` field |
| `401 Unauthorized` | Missing or expired JWT token |
| `403 Forbidden` | Token valid but role is not `ADMIN` (for admin endpoints) |
| `404 Not Found` | The class / recording / user ID does not exist |

**Example error body**
```json
{
  "statusCode": 400,
  "message": "Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.",
  "error": "Bad Request"
}
```

---

## Axios example (React / Next.js)

```js
import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });

// Interceptor: attach token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Upload class thumbnail
export async function uploadClassThumbnail(classId, file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/classes/${classId}/thumbnail`, form);
  return data.thumbnail; // S3 URL
}

// Upload recording thumbnail
export async function uploadRecordingThumbnail(recordingId, file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/recordings/${recordingId}/thumbnail`, form);
  return data.thumbnail;
}

// Upload student avatar
export async function uploadStudentAvatar(userId, file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/users/students/${userId}/avatar`, form);
  return data.avatarUrl;
}

// Generic upload (get URL without updating any record)
export async function uploadToS3(file, folder = 'general') {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/upload/image?folder=${folder}`, form);
  return data.url;
}
```

---

## S3 Folder Structure

| Folder | Used for |
|---|---|
| `classes/` | Class thumbnail images |
| `recordings/` | Recording thumbnail images |
| `avatars/` | Student / user profile pictures |
| `general/` | Any other images via generic endpoint |

> Files are stored with a UUID filename to prevent collisions:  
> `classes/550e8400-e29b-41d4-a716-446655440000.jpg`
