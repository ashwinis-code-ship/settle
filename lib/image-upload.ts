/**
 * Image Upload Utilities
 * 
 * Handles image picking, compression, and upload to Supabase Storage.
 */

import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import { supabase } from './supabase';

export type ImageBucket = 'avatars' | 'group-images';

interface UploadResult {
  success: boolean;
  url: string | null;
  error: string | null;
}

/**
 * Request camera permissions
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission Required',
      'Please allow camera access to take photos.',
      [{ text: 'OK' }]
    );
    return false;
  }
  return true;
}

/**
 * Request media library permissions
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission Required',
      'Please allow photo library access to choose photos.',
      [{ text: 'OK' }]
    );
    return false;
  }
  return true;
}

/**
 * Pick image from camera
 */
export async function pickImageFromCamera(): Promise<string | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * Pick image from library
 */
export async function pickImageFromLibrary(): Promise<string | null> {
  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * Convert image URI to blob for upload
 */
async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

/**
 * Generate a unique filename for upload
 */
function generateFilename(extension: string = 'jpg'): string {
  return `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
}

/**
 * Get file extension from URI or default to jpg
 */
function getFileExtension(uri: string): string {
  const match = uri.match(/\.(\w+)$/);
  return match ? match[1].toLowerCase() : 'jpg';
}

/**
 * Upload image to Supabase Storage
 */
export async function uploadImage(
  uri: string,
  bucket: ImageBucket,
  folder: string // userId for avatars, groupId for group-images
): Promise<UploadResult> {
  try {
    const extension = getFileExtension(uri);
    const filename = generateFilename(extension);
    const path = `${folder}/${filename}`;

    // Convert URI to blob
    const blob = await uriToBlob(uri);

    // Get mime type
    const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error('[ImageUpload] Upload error:', error);
      return { success: false, url: null, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return { success: true, url: urlData.publicUrl, error: null };
  } catch (err) {
    console.error('[ImageUpload] Error:', err);
    return {
      success: false,
      url: null,
      error: err instanceof Error ? err.message : 'Failed to upload image',
    };
  }
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteImage(
  bucket: ImageBucket,
  path: string
): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      console.error('[ImageUpload] Delete error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[ImageUpload] Delete error:', err);
    return false;
  }
}

/**
 * Extract path from a public URL for deletion
 */
export function getPathFromUrl(url: string, bucket: ImageBucket): string | null {
  try {
    // URL format: https://xxx.supabase.co/storage/v1/object/public/bucket/path
    const match = url.match(new RegExp(`${bucket}/(.+)$`));
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Upload avatar image for a user
 */
export async function uploadAvatar(
  uri: string,
  userId: string
): Promise<UploadResult> {
  return uploadImage(uri, 'avatars', userId);
}

/**
 * Upload group image
 */
export async function uploadGroupImage(
  uri: string,
  groupId: string
): Promise<UploadResult> {
  return uploadImage(uri, 'group-images', groupId);
}
