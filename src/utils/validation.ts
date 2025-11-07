/**
 * File validation utilities
 */

import { ErrorType, type AppError } from '../types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/tiff'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tiff', '.tif'];

/**
 * Validate uploaded blueprint file
 */
export function validateBlueprintFile(file: File): AppError | null {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      type: ErrorType.FILE_TOO_LARGE,
      message: 'File size must be under 10MB',
      details: `Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }
  
  // Check file type
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  const isValidType = ALLOWED_TYPES.includes(file.type);
  const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExtension);
  
  if (!isValidType && !isValidExtension) {
    return {
      type: ErrorType.INVALID_FORMAT,
      message: 'Please upload a PNG, JPG, or TIFF file',
      details: `Received: ${file.type || 'unknown type'}`,
    };
  }
  
  return null;
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

