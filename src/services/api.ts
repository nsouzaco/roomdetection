/**
 * API client for room detection service
 * Currently using mock data - will be replaced with real AWS Lambda calls
 */
import axios, { AxiosError } from 'axios';
import type { DetectionResponse, DetectionRequest, AppError } from '../types';
import { ErrorType } from '../types';

// API configuration (will be replaced with actual AWS API Gateway endpoint)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance with retry logic
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * Retry failed requests with exponential backoff
 */
const retryRequest = async (error: AxiosError, retryCount = 0): Promise<any> => {
  if (retryCount >= MAX_RETRIES) {
    throw error;
  }
  
  // Only retry on network errors or 5xx server errors
  if (!error.response || (error.response.status >= 500 && error.response.status < 600)) {
    const delay = RETRY_DELAY * Math.pow(2, retryCount);
    await new Promise((resolve) => setTimeout(resolve, delay));
    
    return apiClient.request(error.config!);
  }
  
  throw error;
};

// Add response interceptor for retry logic
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const retryCount = error.config.retryCount || 0;
    error.config.retryCount = retryCount + 1;
    
    try {
      return await retryRequest(error, retryCount);
    } catch (retryError) {
      return Promise.reject(retryError);
    }
  }
);

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
 * Detect rooms from blueprint file using AWS Lambda backend
 */
export async function detectRooms(request: DetectionRequest): Promise<DetectionResponse> {
  try {
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

