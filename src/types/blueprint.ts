/**
 * Core types for blueprint detection system
 */

/**
 * Represents a detected room with normalized coordinates
 */
export interface DetectedRoom {
  id: string;
  /** Bounding box in normalized coordinates [x_min, y_min, x_max, y_max] (0-1000 range) */
  bounding_box: [number, number, number, number];
  /** Detection confidence score (0-1) */
  confidence: number;
  /** Optional room name hint from detection */
  name_hint?: string;
}

/**
 * API response from room detection service
 */
export interface DetectionResponse {
  rooms: DetectedRoom[];
  processing_time_ms: number;
  model_version: string;
}

/**
 * Detection request payload
 */
export interface DetectionRequest {
  file: File;
  options?: DetectionOptions;
}

/**
 * Optional detection parameters
 */
export interface DetectionOptions {
  /** Minimum confidence threshold (0-1) */
  confidence_threshold?: number;
  /** Enable preprocessing enhancements */
  enhance?: boolean;
}

/**
 * Blueprint file metadata
 */
export interface BlueprintFile {
  file: File;
  preview: string;
  width: number;
  height: number;
}

/**
 * Room with pixel coordinates for canvas rendering
 */
export interface CanvasRoom extends Omit<DetectedRoom, 'bounding_box'> {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Whether the room is currently selected */
  selected?: boolean;
}

/**
 * Processing status states
 */
export enum ProcessingStatus {
  IDLE = 'idle',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  ERROR = 'error',
}

/**
 * Error types
 */
export enum ErrorType {
  FILE_TOO_LARGE = 'file_too_large',
  INVALID_FORMAT = 'invalid_format',
  PROCESSING_FAILED = 'processing_failed',
  NETWORK_ERROR = 'network_error',
  UNKNOWN = 'unknown',
}

/**
 * Application error with user-friendly message
 */
export interface AppError {
  type: ErrorType;
  message: string;
  details?: string;
}

