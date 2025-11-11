"""
YOLO Room Detection Service - FastAPI Application
Uses Roboflow Direct API for room detection (lightweight, no SDK)
"""
import os
import io
import time
import logging
import base64
from typing import List, Dict, Any
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="YOLO Room Detection Service (Roboflow Direct API)",
    description="High-accuracy room detection using Roboflow Direct API",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
NORMALIZED_RANGE = 1000
ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "S6mAH8NfqXgodc6InODR")
ROBOFLOW_MODEL_ID = "room-detection-r0fta/1"
ROBOFLOW_API_URL = f"https://detect.roboflow.com/{ROBOFLOW_MODEL_ID}"


@app.get("/health")
async def health_check():
    """Health check endpoint for ECS"""
    return {
        "status": "healthy",
        "model": ROBOFLOW_MODEL_ID,
        "service": "roboflow-direct-api",
        "api_configured": bool(ROBOFLOW_API_KEY)
    }


@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "YOLO Room Detection Service (Roboflow Direct API)",
        "version": "2.0.0",
        "model": ROBOFLOW_MODEL_ID,
        "provider": "Roboflow Direct API",
        "endpoints": {
            "health": "/health",
            "detect": "/detect (POST)"
        }
    }


@app.post("/detect")
async def detect_rooms(file: UploadFile = File(...)):
    """
    Detect rooms in a blueprint image using Roboflow Direct API
    
    Args:
        file: Blueprint image file (PNG, JPG, etc.)
        
    Returns:
        JSON response with detected rooms and metadata
    """
    start_time = time.time()
    
    try:
        # Validate API key
        if not ROBOFLOW_API_KEY:
            raise HTTPException(
                status_code=503,
                detail="Roboflow API key not configured"
            )
        
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {file.content_type}. Must be an image."
            )
        
        # Read image
        logger.info(f"Processing upload: {file.filename}")
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))
        img_width, img_height = image.size
        
        logger.info(f"Image size: {img_width}x{img_height}")
        
        # Convert image to base64
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        # Call Roboflow Direct API
        logger.info(f"Calling Roboflow API: {ROBOFLOW_MODEL_ID}")
        response = requests.post(
            ROBOFLOW_API_URL,
            params={
                "api_key": ROBOFLOW_API_KEY,
                "confidence": 25,
            },
            data=img_base64,
            headers={
                "Content-Type": "application/x-www-form-urlencoded"
            },
            timeout=10
        )
        
        if response.status_code != 200:
            logger.error(f"Roboflow API error: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Roboflow API error: {response.text}"
            )
        
        result = response.json()
        predictions = result.get('predictions', [])
        logger.info(f"Roboflow returned {len(predictions)} predictions")
        
        # Convert Roboflow predictions to our API format
        rooms = []
        
        for idx, pred in enumerate(predictions):
            # Roboflow returns: x, y (center), width, height
            x_center = pred['x']
            y_center = pred['y']
            width = pred['width']
            height = pred['height']
            confidence = pred.get('confidence', 0.0)
            
            # Convert to corner coordinates
            x1 = int(x_center - width / 2)
            y1 = int(y_center - height / 2)
            x2 = int(x_center + width / 2)
            y2 = int(y_center + height / 2)
            
            # Normalize to 0-1000 range
            normalized_bbox = [
                int((x1 / img_width) * NORMALIZED_RANGE),
                int((y1 / img_height) * NORMALIZED_RANGE),
                int((x2 / img_width) * NORMALIZED_RANGE),
                int((y2 / img_height) * NORMALIZED_RANGE),
            ]
            
            rooms.append({
                'id': f'room_{idx:03d}',
                'bounding_box': normalized_bbox,
                'confidence': round(confidence, 2),
                'name_hint': pred.get('class', None),
            })
        
        # Sort by confidence (highest first)
        rooms.sort(key=lambda r: r['confidence'], reverse=True)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        logger.info(f"Detection complete: {len(rooms)} rooms found in {processing_time}ms")
        
        return {
            'rooms': rooms,
            'processing_time_ms': processing_time,
            'model_version': ROBOFLOW_MODEL_ID,
            'service': 'roboflow-direct-api'
        }
        
    except HTTPException:
        raise
    except requests.exceptions.RequestException as e:
        logger.error(f"Roboflow API request failed: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Roboflow API unavailable: {str(e)}")
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
