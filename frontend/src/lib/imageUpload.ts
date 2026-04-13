import api from './api';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_MEDIA_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MEDIA_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/jpg',
];
const MEDIA_ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt',
  '.zip', '.rar', '.jpg', '.jpeg', '.png', '.webp', '.gif',
];

export type UploadFolder = 'classes' | 'recordings' | 'avatars' | 'general' | 'media';

function extractErrorMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.message || fallback;
}

export function validateImageFile(file: File) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('Image size must be 5 MB or smaller.');
  }
}

function hasAllowedMediaExtension(fileName: string) {
  const lowerName = fileName.toLowerCase();
  return MEDIA_ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

export function validateMediaFile(file: File) {
  const mimeAllowed = MEDIA_ALLOWED_MIME_TYPES.includes(file.type);
  const extAllowed = hasAllowedMediaExtension(file.name);
  if (!mimeAllowed && !extAllowed) {
    throw new Error('Invalid file type. Allowed: PDF, Word, Excel, PowerPoint, text, zip/rar, and image files.');
  }
  if (file.size > MAX_MEDIA_FILE_SIZE_BYTES) {
    throw new Error('File size must be 25 MB or smaller.');
  }
}

export async function uploadImage(file: File, folder: UploadFolder = 'general') {
  validateImageFile(file);
  const form = new FormData();
  form.append('file', file);

  try {
    const { data } = await api.post(`/upload/image?folder=${folder}`, form);
    return data.url as string;
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, 'Failed to upload image.'));
  }
}

export async function uploadMediaFile(file: File, folder: UploadFolder = 'media') {
  validateMediaFile(file);
  const form = new FormData();
  form.append('file', file);

  try {
    const { data } = await api.post(`/upload/file?folder=${folder}`, form);
    return data.url as string;
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, 'Failed to upload file.'));
  }
}

export async function uploadClassThumbnail(classId: string, file: File) {
  validateImageFile(file);
  const form = new FormData();
  form.append('file', file);

  try {
    const { data } = await api.post(`/classes/${classId}/thumbnail`, form);
    return data.thumbnail as string;
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, 'Failed to upload class thumbnail.'));
  }
}

export async function uploadRecordingThumbnail(recordingId: string, file: File) {
  validateImageFile(file);
  const form = new FormData();
  form.append('file', file);

  try {
    const { data } = await api.post(`/recordings/${recordingId}/thumbnail`, form);
    return data.thumbnail as string;
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, 'Failed to upload recording thumbnail.'));
  }
}

export async function uploadStudentAvatar(userId: string, file: File) {
  validateImageFile(file);
  const form = new FormData();
  form.append('file', file);

  try {
    const { data } = await api.post(`/users/students/${userId}/avatar`, form);
    return data.avatarUrl as string;
  } catch (error: any) {
    throw new Error(extractErrorMessage(error, 'Failed to upload student avatar.'));
  }
}
