import api from './api';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export type UploadFolder = 'classes' | 'recordings' | 'avatars' | 'general';

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
