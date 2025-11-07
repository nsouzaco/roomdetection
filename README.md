# Location Detection AI 🏗️

An AI-powered web application that automatically detects room boundaries from architectural blueprints, drastically reducing manual tracing time from 5 minutes to under 30 seconds.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Phase](https://img.shields.io/badge/phase-MVP-green.svg)
![Tech](https://img.shields.io/badge/tech-React%20%7C%20TypeScript%20%7C%20AWS-orange.svg)

## 🎯 Features

- **Drag-and-Drop Upload**: Intuitive file upload for PNG, JPG, and TIFF blueprints
- **Automatic Detection**: AI-powered room boundary detection using OpenCV
- **Visual Canvas**: Interactive Konva.js canvas for viewing and adjusting detected rooms
- **Confidence Scores**: Each detection includes a confidence score for quality assessment
- **Real-time Processing**: Complete detection in <30 seconds end-to-end
- **Export Results**: Download detection results as JSON for further processing

## 🏛️ Architecture

```
┌──────────────────┐
│  React Frontend  │
│  (Vite + TS)     │
└────────┬─────────┘
         │ HTTPS
         ▼
┌──────────────────┐
│  API Gateway     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐      ┌───────────────┐
│  Lambda (Python) │◄────►│  S3 Bucket    │
│  OpenCV + NumPy  │      │  (Blueprints) │
└──────────────────┘      └───────────────┘
         │
         ▼
┌──────────────────┐
│  CloudWatch      │
│  (Monitoring)    │
└──────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+ (for backend development)
- **AWS Account** (for deployment)
- **AWS CLI** configured with credentials
- **Docker** (for Lambda containerization)

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The frontend will be available at `http://localhost:5173`

### Backend Setup

```bash
# Navigate to infrastructure directory
cd backend/infrastructure

# Install CDK dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy to AWS
cdk deploy
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_API_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod
```

## 📦 Project Structure

```
roomdetection/
├── src/                    # Frontend React application
│   ├── components/         # React components
│   │   ├── upload/        # File upload components
│   │   ├── canvas/        # Blueprint canvas
│   │   └── common/        # Shared UI components
│   ├── services/          # API client
│   ├── types/             # TypeScript definitions
│   ├── utils/             # Helper functions
│   └── hooks/             # Custom React hooks
├── backend/               # Backend services
│   ├── lambda/           # Lambda function code
│   │   ├── room_detector.py    # OpenCV detection logic
│   │   ├── requirements.txt    # Python dependencies
│   │   └── Dockerfile          # Lambda container
│   └── infrastructure/   # AWS CDK code
│       ├── bin/          # CDK app entry
│       └── lib/          # CDK stacks
├── memory-bank/          # Project documentation
└── public/               # Static assets
```

## 🎨 Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Konva.js** - Canvas manipulation
- **React Dropzone** - File uploads
- **Axios** - HTTP client

### Backend
- **AWS Lambda** - Serverless compute
- **Python 3.11** - Runtime
- **OpenCV** - Computer vision
- **NumPy** - Numerical operations
- **API Gateway** - REST API
- **S3** - File storage
- **CloudWatch** - Monitoring

### Infrastructure
- **AWS CDK** - Infrastructure as Code
- **Docker** - Lambda containerization

## 🔍 How It Works

### Phase 1: OpenCV-based Detection (Current)

1. **Upload**: User uploads a blueprint image
2. **Preprocessing**: 
   - Convert to grayscale
   - Apply CLAHE enhancement
   - Gaussian blur for noise reduction
3. **Edge Detection**:
   - Canny edge detector with adaptive thresholds
   - Morphological operations to close gaps
4. **Contour Detection**:
   - Find external contours
   - Filter by area (min/max thresholds)
   - Approximate to reduce vertices
5. **Post-Processing**:
   - Merge overlapping detections (IoU > 0.3)
   - Filter invalid rooms
   - Convert to bounding boxes
6. **Response**: Return normalized coordinates (0-1000 range)

### Phase 2: YOLO v8 Integration (Planned)

- Fine-tuned YOLO v8 model on annotated blueprint dataset
- Target accuracy: ≥85% for varied blueprints
- Deployment via SageMaker endpoint
- Expected in Weeks 4-6

## 📊 Performance Targets

| Metric | Target | Current (Mock) |
|--------|--------|----------------|
| **End-to-End Latency** | <30s | ~2s (mock) |
| **Rectangular Room Accuracy** | ≥85% | TBD |
| **Complex Room Accuracy** | ≥70% | TBD |
| **False Positive Rate** | <5% | TBD |
| **Cost per Blueprint** | <$0.05 | ~$0.002 |

## 🧪 Testing

```bash
# Run frontend tests (when implemented)
npm test

# Run linter
npm run lint

# Type checking
npm run build
```

## 📝 API Documentation

### POST /detect

Detect room boundaries from blueprint image.

**Request:**
```json
{
  "file": "multipart/form-data",
  "options": {
    "confidence_threshold": 0.7,
    "enhance": true
  }
}
```

**Response:**
```json
{
  "rooms": [
    {
      "id": "room_001",
      "bounding_box": [100, 100, 350, 300],
      "confidence": 0.92,
      "name_hint": "Living Room"
    }
  ],
  "processing_time_ms": 450,
  "model_version": "phase_1_opencv"
}
```

### POST /upload-url

Get pre-signed S3 URL for direct upload.

**Request:**
```json
{
  "filename": "blueprint.png"
}
```

**Response:**
```json
{
  "upload_url": "https://s3.amazonaws.com/...",
  "key": "uploads/blueprint.png"
}
```

## 🚧 Roadmap

- [x] Phase 1: Frontend UI with mock data
- [x] Phase 1: OpenCV-based detection
- [x] Phase 1: AWS infrastructure setup
- [ ] Phase 1: End-to-end testing with real blueprints
- [ ] Phase 2: YOLO v8 model training
- [ ] Phase 2: SageMaker deployment
- [ ] Phase 3: Vision Transformer exploration

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 📧 Contact

For questions or support, please open an issue on GitHub.

## 🙏 Acknowledgments

- OpenCV community for computer vision tools
- AWS for serverless infrastructure
- React and TypeScript communities

---

**Built with ❤️ for Innergy**
