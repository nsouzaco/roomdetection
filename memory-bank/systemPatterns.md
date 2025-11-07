# System Patterns

## Architecture Overview

```
┌─────────────────┐
│  React Frontend │
│  (User Upload)  │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  API Gateway    │
│  (REST API)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Lambda         │─────▶│  S3 Bucket   │
│  (Orchestrator) │◀─────│  (Temp Files)│
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐
│  ML Processing  │
│  Phase 1: OpenCV│
│  Phase 2: YOLO  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Post-Process   │
│  (Merge, Filter)│
└────────┬────────┘
         │
         ▼
   JSON Response
```

## Key Technical Decisions

### 1. Serverless Architecture
**Decision**: Use AWS Lambda + API Gateway instead of EC2
**Rationale**:
- No server management overhead
- Automatic scaling for concurrent requests
- Pay-per-use pricing (<$0.05/request target)
- Handles cold starts acceptably (<3s)

### 2. Progressive AI Implementation
**Phase 1**: OpenCV-based traditional CV
- Edge detection → Contour detection → Bounding boxes
- Fast to implement, no training data needed
- Works well on clean blueprints (~75% accuracy)
- Lambda-native deployment

**Phase 2**: YOLO v8 object detection
- Pre-trained model fine-tuned on blueprints
- Handles rotation, quality issues, complex shapes
- Target 85%+ accuracy
- SageMaker endpoint or Lambda + ECR

### 3. Coordinate Normalization
**Pattern**: All coordinates returned in 0-1000 normalized range
**Rationale**:
- Format-agnostic (works with any blueprint size)
- Easy to scale to actual pixel dimensions on frontend
- Consistent API regardless of input image resolution

### 4. Frontend Canvas Management
**Decision**: Use Konva.js or Fabric.js for blueprint visualization
**Rationale**:
- Handle overlay of detected boundaries on blueprint
- Support user interaction (drag, resize, adjust)
- Better than raw Canvas API (less verbose, easier iteration)

## Data Flow

### Upload Flow
1. User selects blueprint file in React UI
2. File validated (format, size limits)
3. Upload to S3 with pre-signed URL (direct upload, bypasses Lambda limits)
4. Trigger Lambda processing via API Gateway
5. Lambda retrieves file from S3

### Processing Flow
1. **Preprocessing**:
   - Resize to standard dimensions (640x640 for YOLO)
   - Normalize pixel values
   - Contrast enhancement (CLAHE)
   - Deskewing if rotated

2. **Detection**:
   - Phase 1: OpenCV edge/contour detection
   - Phase 2: YOLO v8 inference

3. **Post-processing**:
   - Merge overlapping detections (IoU threshold: 0.3)
   - Filter unrealistic rooms (min/max dimensions)
   - Snap corners to detected edges
   - Sort by room size

4. **Response**:
   - JSON with normalized coordinates
   - Confidence scores per room
   - Processing metadata

### Response Format
```json
{
  "rooms": [
    {
      "id": "room_001",
      "bounding_box": [x_min, y_min, x_max, y_max],
      "confidence": 0.92,
      "name_hint": "Kitchen"
    }
  ],
  "processing_time_ms": 450,
  "model_version": "phase_1_opencv"
}
```

## Component Relationships

### Frontend Components
- **UploadZone**: Drag-and-drop file upload
- **BlueprintCanvas**: Konva.js canvas for visualization
- **RoomOverlay**: Individual room boundary visualization
- **ControlPanel**: Accept/reject/adjust controls
- **ProcessingStatus**: Loading states and progress

### Backend Services
- **API Handler**: Express-like routing in Lambda
- **FileProcessor**: S3 upload/download management
- **PreprocessingPipeline**: Image normalization and enhancement
- **ModelInference**: OpenCV or YOLO execution
- **PostProcessor**: Detection refinement and formatting
- **ResponseFormatter**: JSON response construction

## Error Handling Patterns

### Frontend
- Show user-friendly error messages
- Retry failed uploads automatically (up to 3 times)
- Handle Lambda cold starts gracefully
- Validate file formats before upload

### Backend
- Structured JSON logging to CloudWatch
- Graceful degradation (return partial results if possible)
- Timeout handling (25s warning, 30s hard limit)
- Invalid input rejection with clear error messages

## Monitoring Strategy

### Metrics to Track
- Average inference latency per blueprint
- Model accuracy (from user feedback)
- API error rates
- Cold start frequency
- S3 storage costs

### Alerts
- Alert if latency >25s (80% of SLA)
- Alert if accuracy <75%
- Alert if API error rate >5%

