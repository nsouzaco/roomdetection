# Project Brief: Location Detection AI

## Project Overview
An AI-powered service that automatically detects and outputs room boundaries from architectural blueprint images, eliminating the manual tracing effort currently required from users.

## Core Problem
Users at Innergy waste significant time manually drawing room boundaries on architectural blueprints using 2D CAD tools. Current process takes ~5 minutes for a 10-room floor plan.

## Solution
Build a dedicated AI service that:
- Accepts blueprint images (PNG/JPG/TIFF/PDF)
- Processes them using computer vision/ML models
- Returns normalized coordinates of detected room boundaries
- Reduces processing time from 5 minutes to under 30 seconds

## Success Criteria
- **Speed**: Process blueprints in <30 seconds end-to-end
- **Accuracy**: ≥85% for rectangular rooms, ≥70% for complex shapes
- **User Experience**: Intuitive upload, automatic detection, manual adjustment capability
- **Sales Impact**: Major competitive differentiator

## Technical Approach
**Phase 1 (MVP)**: OpenCV + traditional computer vision
- Fast implementation, no training required
- Target: 75% accuracy on clean blueprints

**Phase 2 (Production)**: YOLO v8 integration
- Fine-tuned on annotated blueprint dataset
- Target: 85%+ accuracy on varied blueprints

## Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: AWS Lambda + API Gateway
- **ML Serving**: Lambda (Phase 1) → SageMaker (Phase 2)
- **Visualization**: Konva.js or Fabric.js for blueprint canvas

## Key Constraints
- Must use AWS
- <30 second processing time
- <$0.05 per blueprint processing cost
- No "magic" - all decisions documented and transparent
- Handle 50+ concurrent requests

## Timeline
- **Weeks 1-3**: MVP with OpenCV
- **Weeks 4-6**: YOLO v8 integration
- **Ongoing**: Refinement and optimization

