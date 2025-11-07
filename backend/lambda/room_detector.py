"""
Room detection Lambda function - Phase 1: OpenCV-based detection
Detects room boundaries from architectural blueprints using traditional computer vision
"""
import json
import base64
import logging
from typing import List, Tuple, Dict, Any
import cv2
import numpy as np
from io import BytesIO
from PIL import Image

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Constants
NORMALIZED_RANGE = 1000
MIN_ROOM_AREA = 5000  # Minimum area in pixels to be considered a room
MAX_ROOM_AREA = 500000  # Maximum area to filter out full-blueprint detections
CONFIDENCE_BASE = 0.7  # Base confidence for OpenCV detections


def preprocess_image(image: np.ndarray) -> np.ndarray:
    """
    Preprocess blueprint image for better edge detection
    
    Args:
        image: Input image as numpy array
        
    Returns:
        Preprocessed grayscale image
    """
    # Convert to grayscale if needed
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image
    
    # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    # Apply Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(enhanced, (5, 5), 0)
    
    return blurred


def detect_edges(image: np.ndarray) -> np.ndarray:
    """
    Detect edges using Canny edge detector
    
    Args:
        image: Preprocessed grayscale image
        
    Returns:
        Binary edge image
    """
    # Use fixed thresholds that work well for most floor plans
    # Lower threshold: 50 (detects weaker edges)
    # Upper threshold: 150 (strong edges)
    edges = cv2.Canny(image, 50, 150)
    
    logger.info(f"Edge detection complete, edge pixels: {np.count_nonzero(edges)}")
    
    # Apply morphological operations to close gaps and strengthen edges
    kernel = np.ones((5, 5), np.uint8)
    
    # Dilate to connect nearby edges (important for room boundaries)
    edges = cv2.dilate(edges, kernel, iterations=2)
    
    # Erode to thin the edges back
    edges = cv2.erode(edges, kernel, iterations=1)
    
    # Close small holes in the edges
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
    
    return edges


def find_room_contours(edges: np.ndarray, original_shape: Tuple[int, int]) -> List[np.ndarray]:
    """
    Find room contours from edge image
    
    Args:
        edges: Binary edge image
        original_shape: Original image shape (height, width)
        
    Returns:
        List of valid room contours
    """
    # Find all contours (not just external ones)
    # This is important for colored floor plans where rooms are filled regions
    contours, hierarchy = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    logger.info(f"Found {len(contours)} total contours before filtering")
    
    # Filter contours by area
    valid_contours = []
    height, width = original_shape
    image_area = height * width
    
    # Calculate dynamic area thresholds based on image size
    # For a 3000x3000 image, min_area = 50,000 (about 224x224px)
    # This scales with image size
    min_area = max(MIN_ROOM_AREA, image_area * 0.005)  # At least 0.5% of image
    max_area = min(MAX_ROOM_AREA, image_area * 0.4)    # At most 40% of image
    
    logger.info(f"Area thresholds: min={min_area:.0f}, max={max_area:.0f}, image_area={image_area}")
    
    for idx, contour in enumerate(contours):
        area = cv2.contourArea(contour)
        
        # Filter by area constraints
        if min_area < area < max_area:
            # Approximate contour to reduce vertices
            epsilon = 0.02 * cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            # Log the contour for debugging
            logger.info(f"Valid contour {idx}: area={area:.0f}, vertices={len(approx)}")
            valid_contours.append(approx)
    
    logger.info(f"Filtered to {len(valid_contours)} valid contours")
    return valid_contours


def contour_to_bounding_box(contour: np.ndarray) -> Tuple[int, int, int, int]:
    """
    Convert contour to bounding box
    
    Args:
        contour: Contour as numpy array
        
    Returns:
        Tuple of (x_min, y_min, x_max, y_max)
    """
    x, y, w, h = cv2.boundingRect(contour)
    return (x, y, x + w, y + h)


def calculate_confidence(contour: np.ndarray, edges: np.ndarray) -> float:
    """
    Calculate detection confidence based on contour properties
    
    Args:
        contour: Detected contour
        edges: Edge image
        
    Returns:
        Confidence score (0-1)
    """
    # Base confidence
    confidence = CONFIDENCE_BASE
    
    # Boost confidence for rectangular shapes
    epsilon = 0.02 * cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, epsilon, True)
    if len(approx) == 4:
        confidence += 0.15
    
    # Boost confidence for convex shapes
    if cv2.isContourConvex(approx):
        confidence += 0.1
    
    # Cap at 0.95 for OpenCV-based detection
    return min(confidence, 0.95)


def normalize_coordinates(
    bbox: Tuple[int, int, int, int], 
    image_shape: Tuple[int, int]
) -> List[int]:
    """
    Normalize bounding box coordinates to 0-1000 range
    
    Args:
        bbox: Bounding box (x_min, y_min, x_max, y_max)
        image_shape: Image shape (height, width)
        
    Returns:
        Normalized coordinates [x_min, y_min, x_max, y_max]
    """
    height, width = image_shape
    x_min, y_min, x_max, y_max = bbox
    
    return [
        int((x_min / width) * NORMALIZED_RANGE),
        int((y_min / height) * NORMALIZED_RANGE),
        int((x_max / width) * NORMALIZED_RANGE),
        int((y_max / height) * NORMALIZED_RANGE),
    ]


def merge_overlapping_boxes(
    boxes: List[Dict[str, Any]], 
    iou_threshold: float = 0.3
) -> List[Dict[str, Any]]:
    """
    Merge overlapping bounding boxes
    
    Args:
        boxes: List of detected rooms
        iou_threshold: IoU threshold for merging
        
    Returns:
        List of merged rooms
    """
    if len(boxes) <= 1:
        return boxes
    
    # Sort by confidence (keep higher confidence boxes)
    boxes = sorted(boxes, key=lambda x: x['confidence'], reverse=True)
    
    merged = []
    used = set()
    
    for i, box1 in enumerate(boxes):
        if i in used:
            continue
            
        # Check for overlaps with remaining boxes
        for j in range(i + 1, len(boxes)):
            if j in used:
                continue
                
            # Calculate IoU (Intersection over Union)
            box2 = boxes[j]
            x1_min, y1_min, x1_max, y1_max = box1['bounding_box']
            x2_min, y2_min, x2_max, y2_max = box2['bounding_box']
            
            # Calculate intersection
            x_inter_min = max(x1_min, x2_min)
            y_inter_min = max(y1_min, y2_min)
            x_inter_max = min(x1_max, x2_max)
            y_inter_max = min(y1_max, y2_max)
            
            if x_inter_max > x_inter_min and y_inter_max > y_inter_min:
                inter_area = (x_inter_max - x_inter_min) * (y_inter_max - y_inter_min)
                box1_area = (x1_max - x1_min) * (y1_max - y1_min)
                box2_area = (x2_max - x2_min) * (y2_max - y2_min)
                union_area = box1_area + box2_area - inter_area
                
                iou = inter_area / union_area if union_area > 0 else 0
                
                if iou > iou_threshold:
                    used.add(j)
        
        merged.append(box1)
    
    return merged


def detect_rooms(image_bytes: bytes) -> Dict[str, Any]:
    """
    Main room detection function
    
    Args:
        image_bytes: Blueprint image as bytes
        
    Returns:
        Detection results with rooms and metadata
    """
    import time
    start_time = time.time()
    
    # Load image
    image = Image.open(BytesIO(image_bytes))
    image_array = np.array(image)
    
    logger.info(f"Image loaded: {image_array.shape}")
    
    # Preprocess
    preprocessed = preprocess_image(image_array)
    
    # Detect edges
    edges = detect_edges(preprocessed)
    
    # Find contours
    contours = find_room_contours(edges, preprocessed.shape)
    logger.info(f"Found {len(contours)} potential rooms")
    
    # Convert to rooms
    rooms = []
    for idx, contour in enumerate(contours):
        bbox = contour_to_bounding_box(contour)
        confidence = calculate_confidence(contour, edges)
        normalized_bbox = normalize_coordinates(bbox, preprocessed.shape)
        
        rooms.append({
            'id': f'room_{idx:03d}',
            'bounding_box': normalized_bbox,
            'confidence': round(confidence, 2),
            'name_hint': None,  # Phase 2: Add name detection
        })
    
    # Merge overlapping boxes
    rooms = merge_overlapping_boxes(rooms)
    
    # Sort by size (larger rooms first)
    rooms.sort(key=lambda r: (
        (r['bounding_box'][2] - r['bounding_box'][0]) * 
        (r['bounding_box'][3] - r['bounding_box'][1])
    ), reverse=True)
    
    processing_time = int((time.time() - start_time) * 1000)
    
    return {
        'rooms': rooms,
        'processing_time_ms': processing_time,
        'model_version': 'phase_1_opencv',
    }


def parse_multipart(body: str, content_type: str) -> bytes:
    """
    Parse multipart/form-data to extract file bytes
    
    Args:
        body: Request body as string
        content_type: Content-Type header value
        
    Returns:
        File bytes
    """
    # Extract boundary from content type
    boundary = None
    for part in content_type.split(';'):
        part = part.strip()
        if part.startswith('boundary='):
            boundary = part.split('=', 1)[1].strip('"')
            break
    
    if not boundary:
        raise ValueError("No boundary found in content-type")
    
    logger.info(f"Parsing multipart with boundary: {boundary}")
    
    # Split body by boundary
    parts = body.split(f'--{boundary}')
    
    # Find the file part
    for part in parts:
        if not part or part.strip() == '--':
            continue
        
        # Split headers from content
        if '\r\n\r\n' in part:
            headers, content = part.split('\r\n\r\n', 1)
        elif '\n\n' in part:
            headers, content = part.split('\n\n', 1)
        else:
            continue
        
        # Check if this part contains a file
        if 'Content-Disposition' in headers and 'filename' in headers:
            # Remove trailing boundary markers
            content = content.split(f'--{boundary}')[0]
            # Remove trailing newlines
            content = content.rstrip('\r\n-')
            
            logger.info(f"Found file part, content length: {len(content)} bytes")
            return content.encode('latin-1')  # Preserve binary data
    
    raise ValueError("No file found in multipart data")


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler function
    
    Args:
        event: API Gateway event
        context: Lambda context
        
    Returns:
        API Gateway response
    """
    try:
        logger.info("Processing room detection request")
        
        # Parse request body
        body = event.get('body', '')
        headers = event.get('headers', {})
        
        # Get content type (handle case-insensitive headers)
        content_type = None
        for key, value in headers.items():
            if key.lower() == 'content-type':
                content_type = value
                break
        
        logger.info(f"Content-Type: {content_type}")
        logger.info(f"Is Base64 Encoded: {event.get('isBase64Encoded', False)}")
        logger.info(f"Body length: {len(body)} bytes")
        
        # Handle base64 encoding from API Gateway
        is_base64 = event.get('isBase64Encoded', False)
        if is_base64:
            body = base64.b64decode(body).decode('latin-1')
        
        # Parse multipart/form-data
        if content_type and 'multipart/form-data' in content_type:
            image_bytes = parse_multipart(body, content_type)
        else:
            # Fallback: assume body is raw image bytes
            image_bytes = body.encode('latin-1') if isinstance(body, str) else body
        
        # Detect rooms
        result = detect_rooms(image_bytes)
        
        logger.info(f"Detection complete: {len(result['rooms'])} rooms found")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
            },
            'body': json.dumps(result),
        }
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}", exc_info=True)
        
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'error': 'Processing failed',
                'message': str(e),
            }),
        }

