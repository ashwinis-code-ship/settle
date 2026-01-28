/**
 * Image Upload Utilities
 * 
 * Handles image picking, compression, and upload to Supabase Storage.
 */

import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
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
 * Upload image to Supabase Storage with retry
 */
export async function uploadImage(
  uri: string,
  bucket: ImageBucket,
  folder: string, // userId for avatars, groupId for group-images
  retries: number = 2
): Promise<UploadResult> {
  let lastError: string | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const extension = getFileExtension(uri);
      const filename = generateFilename(extension);
      const path = `${folder}/${filename}`;

      // Use the new File API - File implements Blob
      const file = new File(uri);
      
      // Check if file exists
      if (!file.exists) {
        return { success: false, url: null, error: 'File does not exist' };
      }

      // Get mime type
      const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

      // Read as ArrayBuffer using the Blob interface
      const arrayBuffer = await file.arrayBuffer();
      
      console.log(`[ImageUpload] Uploading to ${bucket}/${path}, size: ${arrayBuffer.byteLength} bytes, attempt: ${attempt + 1}`);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, arrayBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (error) {
        console.error(`[ImageUpload] Upload error (attempt ${attempt + 1}):`, error);
        lastError = error.message;
        
        // If not last attempt, wait a bit and retry
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        return { success: false, url: null, error: error.message };
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      console.log('[ImageUpload] Upload successful:', urlData.publicUrl);
      return { success: true, url: urlData.publicUrl, error: null };
    } catch (err) {
      console.error(`[ImageUpload] Error (attempt ${attempt + 1}):`, err);
      lastError = err instanceof Error ? err.message : 'Failed to upload image';
      
      // If not last attempt, wait a bit and retry
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
    }
  }
  
  return {
    success: false,
    url: null,
    error: lastError || 'Failed to upload image after retries',
  };
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
