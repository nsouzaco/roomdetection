# Product Requirements Document (PRD): Location Detection AI
## Version 2.0 – Enhanced Technical Architecture

---

## 1. Introduction and Goal

### 1.1 Project Goal
The primary goal of the Location Detection AI project is to drastically reduce the manual effort required by users to define "locations" (rooms, hallways, etc.) on architectural blueprints. We aim to build an AI service capable of automatically detecting and outputting the boundaries of distinct rooms from a blueprint image or vector file.

### 1.2 Context
Innergy users currently spend a significant amount of time manually tracing room boundaries using 2D CAD tools. Automating this step is a critical feature for improving user experience and is expected to be a major selling point for our platform. We previously attempted to outsource this functionality, but the resulting solution was inadequate, necessitating an in-house, robust development effort.

---

## 2. Problem & Business Context

### 2.1 Problem Statement
Users waste a great deal of time drawing room boundaries (often rectangular but sometimes arbitrary shapes) on architectural blueprints. We need an Artificial Intelligence solution that can analyze a blueprint image or vector file and identify the precise boundaries of individual rooms, automating the creation of these "location" objects.

### 2.2 Current State & Opportunity
Currently, we have an internal AI tool that successfully extracts the room name and number after the user manually draws the boundary. The missing piece is the boundary-drawing step itself. Automating this drawing process will save significant user clicking and setup time, transforming a tedious task into an instant process.

### 2.3 Success Metrics (Impact)

**User Efficiency:**
- Reduce time to map a 10-room floor plan from 5 minutes to under 30 seconds
- Achieve ≥85% accuracy for rectangular room detection on first pass
- Achieve ≥70% accuracy for complex/irregular room shapes

**Sales & Market Appeal:**
- The tool is highly attractive for sales, serving as a powerful competitive differentiator
- Enable users to process blueprints in seconds rather than minutes

---

## 3. Proposed Solution: The Location Detection Service

We propose building a dedicated, server-side AI service that acts as a blueprint processing pipeline.

### 3.1 Core Functional Requirement

The service **MUST** be able to:
- Accept a blueprint file (image format: PNG/JPG/TIFF, or scanned PDF converted to raster format)
- Process the file using AI/ML models
- Return normalized coordinates of all detected "rooms" on the blueprint
- The returned coordinates must define the rectangular bounding box or precise shape vertices of the detected room
- Process any blueprint within the latency constraint regardless of orientation, scale, or quality

### 3.2 System Flow (High-Level)

1. User uploads a Blueprint image to the front-end application (React)
2. The application sends the file to the AWS-hosted Location Detection Service (via API Gateway + Lambda)
3. The Service processes the image using the selected AI/ML model and post-processing pipeline
4. The Service returns a JSON object containing the normalized coordinates of detected rooms
5. The React front-end renders the automatically-created room boundaries on the blueprint visualization
6. User can accept detections, manually adjust, or request re-processing with different parameters

---

## 4. Technical Architecture & Stack Decisions

### 4.1 Cloud Platform & Deployment
**Decision: AWS**
- Rationale: Mandatory per original requirement; mature ecosystem for computer vision workloads
- Services to utilize:
  - **AWS Lambda**: Orchestration layer and lightweight entry point
  - **AWS SageMaker** (or ECR + Lambda): Model inference endpoint (decision point below)
  - **Amazon S3**: Temporary storage for blueprint uploads and processed results
  - **API Gateway**: REST API for front-end communication
  - **CloudWatch**: Monitoring and logging

### 4.2 Core AI/ML Model Selection
**Decision: Hybrid Approach – OpenCV + YOLO v8 (Progressive Implementation)**

**Phase 1 (MVP): OpenCV + Traditional Computer Vision**
- Approach: Edge detection → contour detection → bounding box extraction
- Rationale: 
  - Fast to implement (no model training required)
  - Excellent for clean, well-scanned blueprints
  - Zero ML infrastructure overhead
  - Immediate path to production
- Expected accuracy: ~75% on ideal blueprints, degrades on poor-quality scans
- Deployment: Lambda-native (no container needed)

**Phase 2 (Production): YOLO v8 Integration**
- Approach: Pre-trained YOLOv8 medium model, fine-tuned on annotated blueprint dataset
- Rationale:
  - Achieves ≥85% accuracy target across varied blueprint styles
  - Handles rotated, warped, and low-quality blueprints better than traditional CV
  - Inference speed: 200-500ms per image (well under 30s constraint)
  - Smaller model size than Mask R-CNN; faster than Vision Transformers
  - Excellent community support and documentation
- Transition trigger: Phase 1 accuracy plateaus below 80% on production blueprints
- Training data requirement: 500-1000 manually annotated blueprints
- Annotation tool: Roboflow or LabelImg
- Deployment: SageMaker Real-Time Endpoint or Lambda + ECR container

**Why not other models:**
- Mask R-CNN: Overkill for MVP, slower, more complex deployment
- Vision Transformers: Excellent accuracy but high latency and GPU cost; save for Phase 3
- Legacy Faster R-CNN: Outdated, inferior to YOLO v8 for this use case

### 4.3 Front-End Stack
**Technology: React + TypeScript + Vite**
- Rationale:
  - React: Existing codebase compatibility, component reusability
  - TypeScript: Type safety, reduces integration bugs
  - Vite: Fast build times, better DX than Create React App
- Blueprint visualization library: **Konva.js** or **Fabric.js**
  - Reason: Handles overlay of detected room boundaries on blueprint canvas
  - Alternative considered: Canvas API directly (rejected: too verbose, harder to iterate)
- API communication: **Axios** with retry logic (handle occasional Lambda cold starts)

### 4.4 Back-End Services Architecture
**API Layer:**
- Framework: AWS Lambda + API Gateway (serverless)
- Rationale: No server management, automatic scaling, pay-per-use pricing
- Alternative considered: EC2 + Flask (rejected: unnecessary operational overhead for this use case)

**Model Serving:**
- **Option A (MVP/Phase 1): Lambda-native**
  - Run OpenCV directly in Lambda function
  - Deployment: ZIP package or ECR container
  - Cost: Minimal (~$0.002 per request)
  - Latency: 1-3 seconds cold start, 300-500ms warm

- **Option B (Phase 2): SageMaker Real-Time Endpoint**
  - Run YOLO v8 model on managed SageMaker instance
  - Deployment: SageMaker Model + Endpoint configuration
  - Cost: ~$0.10-0.20/hour for persistent instance (or multi-model endpoint for cost sharing)
  - Latency: 200-300ms inference, no cold starts
  - Recommendation: Start here if budget allows; otherwise use Lambda + ECR

**Alternative rejected:**
- Batch Transform (SageMaker): Too slow for real-time use case (requires async processing)
- EMR + Spark: Overkill for this workload, designed for large-scale batch

### 4.5 Data Pipeline & Processing
**Blueprint Input Handling:**
- Supported formats: PNG, JPG, TIFF (raster), scanned PDFs (convert to raster via AWS Textract or local preprocessing)
- Image normalization: Resize to standard dimensions (e.g., 640x640 for YOLO), normalize pixel values
- Preprocessing: Contrast enhancement via OpenCV (CLAHE), deskewing for rotated blueprints

**Output Format:**
- All room coordinates returned in **normalized coordinates (0-1000 range)** for format agnosticity
- JSON schema (unchanged from original PRD):
  ```
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

**Post-Processing:**
- Merge overlapping detections (IoU threshold: 0.3)
- Filter unrealistic rooms (min/max dimensions)
- Snap corners to detected edges for precision refinement
- Sort results by room size for consistency

### 4.6 Monitoring & Observability
**Logging:**
- CloudWatch Logs for Lambda execution, errors, latency metrics
- Structured JSON logging for easy filtering and analysis

**Metrics to track:**
- Average inference latency per blueprint
- Model accuracy (auto-calculated against manual ground truth when user provides feedback)
- Error rates and failure modes
- Cold start frequency and impact

**Alerting:**
- Alert if average latency exceeds 25 seconds (80% of SLA)
- Alert on model accuracy degradation (<75%)
- Alert on API error rate >5%

---

## 5. Implementation Strategy & Phasing

### Phase 1: MVP (Weeks 1-3)
- Deploy OpenCV-based room detection via Lambda
- React front-end integration with mock/real blueprint uploads
- Basic monitoring and error handling
- Target accuracy: ≥75% on test blueprints

### Phase 2: YOLO Integration (Weeks 4-6)
- Collect and annotate 500-1000 blueprints
- Train YOLO v8 model (transfer learning from COCO pre-trained)
- Deploy to SageMaker or Lambda + ECR
- A/B test Phase 1 vs Phase 2 accuracy
- Target accuracy: ≥85% on varied blueprints

### Phase 3: Refinement (Ongoing)
- Gather user feedback on misdetections
- Implement user feedback loop for model retraining
- Explore Vision Transformer models if accuracy plateaus
- Optimize for edge cases (hallways, small rooms, open floor plans)

---

## 6. Performance & SLA Requirements

### 6.1 Latency
- **Target: <30 seconds end-to-end** (from upload to result return)
- Breakdown:
  - File upload: 1-5s (depends on file size and network)
  - Model inference: 200-500ms (Phase 2)
  - Post-processing: 100-200ms
  - API communication: 100-200ms
  - **Buffer for Lambda cold start:** 1-3s (acceptable, amortized by connection reuse)

### 6.2 Accuracy
- Rectangular room detection: ≥85%
- Complex/irregular room detection: ≥70%
- False positive rate: <5% (incorrectly detected rooms)
- Bounding box coordinate tolerance: ±5% of room dimensions

### 6.3 Scalability
- Must handle 50+ concurrent blueprint processing requests
- Lambda auto-scaling enabled (default)
- SageMaker endpoint auto-scaling configured (if Phase 2 option chosen)

### 6.4 Cost Constraints
- Keep inference cost under $0.05 per blueprint (Phase 1: ~$0.002, Phase 2 TBD based on SageMaker vs Lambda decision)
- Monitor S3 costs for temporary file storage

---

## 7. Testing & Validation Strategy

### 7.1 Unit Testing
- OpenCV pipeline: Edge detection, contour filtering, bounding box generation
- YOLO integration: Model loading, inference, output parsing
- Post-processing logic: Overlap detection, coordinate snapping, filtering

### 7.2 Integration Testing
- End-to-end: Upload → Process → Render (via React)
- Latency testing: Confirm <30s on varied blueprint sizes
- Error handling: Invalid files, timeouts, malformed responses

### 7.3 Validation Against Ground Truth
- Manually annotate 100 test blueprints (bounding boxes)
- Calculate IoU (Intersection over Union) for each detection
- Track precision, recall, F1-score

### 7.4 Test Blueprints
- **Phase 1 test set:** 50 clean, well-scanned blueprints (expected >80% accuracy)
- **Phase 2 test set:** 50 varied blueprints (poor quality, rotations, complex layouts) (target ≥85% accuracy)
- **Edge cases:** Open floor plans, hallways, small rooms, nested spaces

---

## 8. Off-Limits Technology & Constraints

The solution must rely on established engineering principles. Any reliance on "Magic" is strictly forbidden. Specifically:
- No proprietary/closed-source AI services (e.g., closed-source blueprint parsing services)
- Model decisions must be documented with rationale
- Preprocessing and post-processing steps must be transparent and auditable
- All inference code must be version-controlled and reproducible

---

## 9. Project Deliverables

### 9.1 Submission Requirements
**Code Repository:**
- GitHub repository with clear README
- Separate branches for `phase_1_opencv` and `phase_2_yolo`
- CI/CD pipeline (GitHub Actions recommended) for testing and deployment

**Demo:**
- Video walkthrough (5-10 minutes) showing:
  - Blueprint upload via React front-end
  - Real-time room detection and display
  - Example outputs for varied blueprint types
- OR live demonstration with interactive Q&A

**Technical Documentation:**
- 2-3 page writeup covering:
  - Model selection rationale (why OpenCV/YOLO, not alternatives)
  - Data preprocessing pipeline
  - Post-processing logic
  - Accuracy metrics and test results
  - Lessons learned and future improvements

**AWS Configuration Documentation:**
- Lambda function configuration (memory, timeout, environment variables)
- API Gateway endpoint definition
- S3 bucket policies and lifecycle rules
- SageMaker endpoint configuration (if Phase 2 implemented)
- CloudWatch monitoring dashboard setup

**Deployment Guide:**
- Step-by-step instructions for deploying to AWS
- Local development setup for testing
- Cost estimation for different deployment options

### 9.2 Optional Enhancements (Post-MVP)
- User feedback loop (flag misdetections, retrain model)
- Support for complex room shapes (polygons, not just bounding boxes)
- Batch processing for multiple blueprints
- Confidence scoring visualization