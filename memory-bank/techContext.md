# Technical Context

## Technologies Used

### Frontend Stack
- **React 19**: Component-based UI library
- **TypeScript**: Type safety and better IDE support
- **Vite**: Fast build tool and dev server
- **Konva.js** (to be added): Canvas manipulation for blueprint visualization
- **Axios** (to be added): HTTP client with retry logic

### Backend Stack (AWS)
- **Lambda**: Serverless compute for API and ML inference
- **API Gateway**: REST API endpoint
- **S3**: Temporary file storage
- **SageMaker** (Phase 2): ML model hosting
- **CloudWatch**: Logging and monitoring

### ML/CV Libraries
- **OpenCV** (Phase 1): Traditional computer vision
  - Edge detection (Canny)
  - Contour detection
  - Bounding box extraction
- **YOLO v8** (Phase 2): Deep learning object detection
  - Pre-trained on COCO dataset
  - Fine-tuned on blueprint dataset
  - Inference time: 200-500ms

### Development Tools
- **ESLint**: Code linting
- **TypeScript Compiler**: Type checking
- **GitHub Actions** (planned): CI/CD pipeline
- **Roboflow or LabelImg** (Phase 2): Dataset annotation

## Development Setup

### Local Frontend Development
```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Project Structure
```
roomdetection/
├── src/
│   ├── components/        # React components
│   ├── services/          # API client, utilities
│   ├── types/             # TypeScript type definitions
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Helper functions
├── public/                # Static assets
├── memory-bank/           # Project documentation
└── .cursor/               # Cursor AI rules (to be created)
```

### Backend Development (Future)
- Separate repository or monorepo structure TBD
- Local Lambda testing with SAM CLI
- Python environment for ML development

## Technical Constraints

### Performance Requirements
- **Latency**: <30s end-to-end (upload to result)
  - File upload: 1-5s
  - Model inference: 200-500ms
  - Post-processing: 100-200ms
  - Lambda cold start buffer: 1-3s

- **Scalability**: Handle 50+ concurrent requests
- **Cost**: <$0.05 per blueprint processing

### Accuracy Requirements
- Rectangular rooms: ≥85% detection rate
- Complex/irregular rooms: ≥70% detection rate
- False positive rate: <5%
- Bounding box tolerance: ±5% of actual dimensions

### File Support
- **Formats**: PNG, JPG, TIFF (raster), scanned PDFs
- **Size limits**: TBD (likely 10MB max for Lambda compatibility)
- **Resolution**: Support various resolutions, normalize to 640x640

## Dependencies

### Current Frontend Dependencies
```json
{
  "react": "^19.1.1",
  "react-dom": "^19.1.1"
}
```

### Planned Frontend Dependencies
- `konva` and `react-konva`: Canvas visualization
- `axios`: HTTP client
- `react-dropzone`: File upload UI
- `@tanstack/react-query`: API state management
- `tailwindcss`: Modern utility-first CSS framework

### Backend Dependencies (Future)
**Python Lambda**:
- `opencv-python-headless`: Computer vision
- `numpy`: Numerical operations
- `boto3`: AWS SDK
- `ultralytics` (Phase 2): YOLO v8
- `torch` (Phase 2): PyTorch for YOLO

## AWS Configuration (Planned)

### Lambda Configuration
- **Runtime**: Python 3.11
- **Memory**: 2048-3008 MB (for OpenCV/YOLO)
- **Timeout**: 30 seconds
- **Environment Variables**:
  - `S3_BUCKET_NAME`: Blueprint storage
  - `MODEL_VERSION`: phase_1_opencv or phase_2_yolo
  - `CONFIDENCE_THRESHOLD`: 0.7

### API Gateway
- **Type**: REST API
- **Endpoints**:
  - `POST /detect`: Upload and process blueprint
  - `GET /status/{job_id}`: Check processing status (future async support)
- **CORS**: Enabled for frontend domain
- **Rate Limiting**: 100 requests/minute per IP

### S3 Bucket
- **Lifecycle Policy**: Delete temporary files after 24 hours
- **Access**: Pre-signed URLs for direct upload
- **Versioning**: Disabled (temporary storage only)

## Testing Strategy

### Frontend Testing (To Implement)
- **Unit Tests**: Vitest + React Testing Library
- **Component Tests**: Test upload, canvas, controls
- **E2E Tests**: Cypress or Playwright (future)

### Backend Testing (To Implement)
- **Unit Tests**: pytest for Python Lambda functions
- **Integration Tests**: LocalStack for AWS service mocking
- **Model Validation**: IoU calculation against ground truth

### Test Data
- 50 clean blueprints for Phase 1
- 50 varied blueprints for Phase 2
- 100 manually annotated blueprints for accuracy validation

## Known Technical Challenges

1. **Lambda Cold Starts**: 1-3s delay on first request
   - Mitigation: Keep Lambda warm with CloudWatch Events
   
2. **Large File Uploads**: Lambda 6MB payload limit
   - Solution: Direct S3 upload with pre-signed URLs
   
3. **Model Size**: YOLO v8 model may exceed Lambda limits
   - Solution: Use Lambda containers (ECR) or SageMaker
   
4. **Rotation Detection**: Blueprints may be rotated
   - Solution: Preprocessing deskewing step
   
5. **Complex Room Shapes**: Beyond simple rectangles
   - Solution: Polygon detection in Phase 2/3

