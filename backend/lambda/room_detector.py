"""
Room detection Lambda function - Phase 2: YOLO-based detection
Detects room boundaries from architectural blueprints using YOLOv8
"""
import json
import base64
import logging
from typing import List, Tuple, Dict, Any
import numpy as np
from io import BytesIO
from PIL import Image
import os

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Constants
NORMALIZED_RANGE = 1000
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'yolov8_room_detector.pt')

# Initialize YOLO model (loaded once per Lambda container)
_model = None

def get_model():
    """
    Get or initialize the YOLO model
    Uses lazy loading to improve Lambda cold start times
    """
    global _model
    if _model is None:
        from ultralytics import YOLO
        logger.info(f"Loading YOLO model from {MODEL_PATH}")
        _model = YOLO(MODEL_PATH)
        logger.info("YOLO model loaded successfully")
    return _model


# All OpenCV helper functions removed - using YOLO now!


def detect_rooms(image_bytes: bytes) -> Dict[str, Any]:
    """
    Main room detection function using YOLOv8
    
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
    
    # Get YOLO model
    model = get_model()
    
    # Run inference
    logger.info("Running YOLO inference...")
    results = model(image_array, verbose=False)[0]
    
    logger.info(f"YOLO found {len(results.boxes)} detections")
    
    # Convert YOLO results to our format
    rooms = []
    height, width = image_array.shape[:2]
    
    for idx, box in enumerate(results.boxes):
        # Get box coordinates (xyxy format)
        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
        confidence = float(box.conf[0].cpu().numpy())
        
        # Normalize coordinates to 0-1000 range
        normalized_bbox = [
            int((x1 / width) * NORMALIZED_RANGE),
            int((y1 / height) * NORMALIZED_RANGE),
            int((x2 / width) * NORMALIZED_RANGE),
            int((y2 / height) * NORMALIZED_RANGE),
        ]
        
        rooms.append({
            'id': f'room_{idx:03d}',
            'bounding_box': normalized_bbox,
            'confidence': round(confidence, 2),
            'name_hint': None,  # Future: Add room type classification
        })
    
    # Sort by confidence (highest first)
    rooms.sort(key=lambda r: r['confidence'], reverse=True)
    
    processing_time = int((time.time() - start_time) * 1000)
    
    logger.info(f"Detection complete: {len(rooms)} rooms found in {processing_time}ms")
    
    return {
        'rooms': rooms,
        'processing_time_ms': processing_time,
        'model_version': 'phase_2_yolov8n',
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

