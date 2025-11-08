/**
 * API client for room detection service
 * Supports both OpenCV (fast) and YOLO (accurate) models
 */
import axios from 'axios';
import type { DetectionResponse, DetectionRequest, AppError } from '../types';
import { ErrorType, DetectionModel } from '../types';

// API configuration
const OPENCV_API_URL = import.meta.env.VITE_OPENCV_API_URL || 'http://localhost:3000';
const YOLO_API_URL = import.meta.env.VITE_YOLO_API_URL || 'http://localhost:3001';
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance with retry logic
const createApiClient = (baseURL: string) => axios.create({
  baseURL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Note: Retry logic can be added per-request if needed

/**
 * Convert axios error to AppError
 */
function handleApiError(error: unknown): AppError {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        type: ErrorType.PROCESSING_FAILED,
        message: 'Request timed out. Please try again.',
        details: 'The server took too long to respond',
      };
    }
    
    if (!error.response) {
      return {
        type: ErrorType.NETWORK_ERROR,
        message: 'Network error. Check your connection and try again.',
        details: error.message,
      };
    }
    
    return {
      type: ErrorType.PROCESSING_FAILED,
      message: error.response.data?.message || 'Failed to process blueprint',
      details: error.response.data?.details,
    };
  }
  
  return {
    type: ErrorType.UNKNOWN,
    message: 'An unexpected error occurred',
    details: String(error),
  };
}

/**
 * Detect rooms from blueprint file using selected detection model
 */
export async function detectRooms(
  request: DetectionRequest,
  model: DetectionModel = DetectionModel.OPENCV
): Promise<DetectionResponse> {
  try {
    const baseURL = model === DetectionModel.YOLO ? YOLO_API_URL : OPENCV_API_URL;
    const apiClient = createApiClient(baseURL);
    
    const formData = new FormData();
    formData.append('file', request.file);
    
    if (request.options) {
      formData.append('options', JSON.stringify(request.options));
    }
    
    const response = await apiClient.post<DetectionResponse>('/detect', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Get pre-signed URL for S3 upload
 * Will be implemented when S3 integration is ready
 */
export async function getPresignedUrl(filename: string): Promise<string> {
  try {
    const apiClient = createApiClient(OPENCV_API_URL);
    const response = await apiClient.post<{ upload_url: string }>('/upload-url', {
      filename,
    });
    
    return response.data.upload_url;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Upload file directly to S3
 * Will be implemented when S3 integration is ready
 */
export async function uploadToS3(file: File, presignedUrl: string): Promise<void> {
  try {
    await axios.put(presignedUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
    });
  } catch (error) {
    throw handleApiError(error);
  }
}

