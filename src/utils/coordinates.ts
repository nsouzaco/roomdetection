/**
 * Coordinate transformation utilities
 * Converts between normalized (0-1000) and pixel coordinates
 */

import type { DetectedRoom, CanvasRoom } from '../types';

/**
 * Convert normalized coordinates (0-1000) to pixel coordinates
 */
export function normalizedToPixel(
  normalized: [number, number, number, number],
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; width: number; height: number } {
  const [x_min, y_min, x_max, y_max] = normalized;
  
  return {
    x: (x_min / 1000) * imageWidth,
    y: (y_min / 1000) * imageHeight,
    width: ((x_max - x_min) / 1000) * imageWidth,
    height: ((y_max - y_min) / 1000) * imageHeight,
  };
}

/**
 * Convert pixel coordinates to normalized (0-1000) coordinates
 */
export function pixelToNormalized(
  x: number,
  y: number,
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number
): [number, number, number, number] {
  const x_min = (x / imageWidth) * 1000;
  const y_min = (y / imageHeight) * 1000;
  const x_max = ((x + width) / imageWidth) * 1000;
  const y_max = ((y + height) / imageHeight) * 1000;
  
  return [
    Math.round(x_min),
    Math.round(y_min),
    Math.round(x_max),
    Math.round(y_max),
  ];
}

/**
 * Convert detected rooms to canvas rooms with pixel coordinates
 */
export function detectedRoomsToCanvas(
  rooms: DetectedRoom[],
  imageWidth: number,
  imageHeight: number
): CanvasRoom[] {
  return rooms.map((room) => {
    const { x, y, width, height } = normalizedToPixel(
      room.bounding_box,
      imageWidth,
      imageHeight
    );
    
    return {
      ...room,
      x,
      y,
      width,
      height,
    };
  });
}

/**
 * Calculate the confidence color based on score
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return '#10b981'; // success-500
  if (confidence >= 0.6) return '#f59e0b'; // warning-500
  return '#ef4444'; // error-500
}

