"""
YOLO Room Detection Service - FastAPI Application
Runs on ECS/Fargate for high-accuracy room detection
"""
import os
import io
import json
import time
import logging
from typing import List, Dict, Any
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np
from ultralytics import YOLO

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="YOLO Room Detection Service",
    description="High-accuracy room detection using YOLOv8",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
NORMALIZED_RANGE = 1000
MODEL_PATH = os.getenv("MODEL_PATH", "/app/models/yolov8_room_detector.pt")

# Global model instance (loaded once at startup)
model = None


@app.on_event("startup")
async def load_model():
    """Load YOLO model on startup"""
    global model
    try:
        logger.info(f"Loading YOLO model from {MODEL_PATH}")
        model = YOLO(MODEL_PATH)
        logger.info("YOLO model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load model: {str(e)}")
        raise


@app.get("/health")
async def health_check():
    """Health check endpoint for ECS"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "service": "yolo-room-detection"
    }


@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "YOLO Room Detection Service",
        "version": "1.0.0",
        "model": "YOLOv8n",
        "accuracy": "99.1% mAP50",
        "endpoints": {
            "health": "/health",
            "detect": "/detect (POST)"
        }
    }


@app.post("/detect")
async def detect_rooms(file: UploadFile = File(...)):
    """
    Detect rooms in a blueprint image using YOLO
    
    Args:
        file: Blueprint image file (PNG, JPG, etc.)
        
    Returns:
        JSON response with detected rooms and metadata
    """
    start_time = time.time()
    
    try:
        # Validate model is loaded
        if model is None:
            raise HTTPException(status_code=503, detail="Model not loaded")
        
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {file.content_type}. Must be an image."
            )
        
        # Read and process image
        logger.info(f"Processing upload: {file.filename}")
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_array = np.array(image)
        
        logger.info(f"Image shape: {image_array.shape}")
        
        # Run YOLO inference
        logger.info("Running YOLO inference...")
        results = model(image_array, verbose=False)[0]
        
        logger.info(f"YOLO found {len(results.boxes)} detections")
        
        # Convert YOLO results to our API format
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
            'model_version': 'yolov8n_phase2',
            'service': 'ecs-fargate'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)

