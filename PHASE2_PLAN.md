# Phase 2: YOLO v8 Integration Plan

Detailed plan for transitioning from OpenCV to YOLO v8 for improved room detection accuracy.

## Goals

- Achieve ≥85% accuracy on varied blueprints (vs 75% with OpenCV)
- Handle rotated, low-quality, and complex layouts
- Reduce false positive rate to <5%
- Maintain <30s processing time
- Keep cost under $0.05 per blueprint

## Timeline

**Weeks 4-6** (after Phase 1 MVP completion)

### Week 4: Data Collection & Annotation

#### Dataset Requirements
- **Quantity**: 500-1000 annotated blueprints
- **Diversity**: 
  - Residential (40%)
  - Commercial (30%)
  - Office spaces (20%)
  - Mixed-use (10%)
- **Quality Variations**:
  - High-resolution scans (60%)
  - Low-quality scans (25%)
  - Rotated/skewed (15%)

#### Data Sources
1. **Internal Sources**
   - Innergy existing blueprint database
   - User-uploaded blueprints (with permission)
   
2. **Public Datasets**
   - CubiCasa5K dataset
   - RPLAN dataset
   - FloorNet dataset
   
3. **Synthetic Data** (if needed)
   - Generate blueprints programmatically
   - Add noise, rotation, quality degradation

#### Annotation Process

**Tool**: Roboflow (recommended) or LabelImg

**Annotation Guidelines:**
- Draw bounding boxes around each room
- Label format: `[x_min, y_min, x_max, y_max]`
- Include room type labels (optional): kitchen, bedroom, bathroom, etc.
- Exclude non-room spaces (hallways, closets <5m²)
- Handle overlapping spaces carefully

**Quality Control:**
- Double-annotation for 10% of dataset
- Inter-annotator agreement: κ > 0.8
- Review by domain expert

**Dataset Split:**
- Training: 70% (350-700 blueprints)
- Validation: 15% (75-150 blueprints)
- Test: 15% (75-150 blueprints)

### Week 5: Model Training

#### Model Selection

**YOLO v8 Medium (yolov8m.pt)**
- **Why Medium?** Balance between speed and accuracy
- Pre-trained on COCO dataset
- Fine-tune on blueprint dataset

**Alternative Models Considered:**
- YOLO v8 Large: Higher accuracy but slower (fallback)
- YOLO v8 Small: Faster but lower accuracy (not recommended)
- Mask R-CNN: Overkill, too slow
- Vision Transformers: Too slow, expensive (Phase 3)

#### Training Configuration

```python
from ultralytics import YOLO

# Load pre-trained model
model = YOLO('yolov8m.pt')

# Training parameters
model.train(
    data='blueprint_dataset.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    patience=20,  # Early stopping
    device='gpu',  # Use GPU
    workers=8,
    optimizer='AdamW',
    lr0=0.001,
    lrf=0.01,
    momentum=0.9,
    weight_decay=0.0005,
    warmup_epochs=3,
    warmup_momentum=0.8,
    box=7.5,
    cls=0.5,
    dfl=1.5,
    augment=True,  # Data augmentation
)
```

**Data Augmentation:**
- Random rotation: ±15°
- Random flip: horizontal/vertical
- Brightness/contrast adjustment
- Gaussian noise injection
- Mosaic augmentation (YOLO-specific)

#### Training Infrastructure

**Option A: AWS SageMaker Training**
- Instance: `ml.g4dn.xlarge` (GPU)
- Spot instances for cost savings (~70% cheaper)
- Training time: ~8-12 hours
- Cost: ~$50-80

**Option B: Local Training**
- Requires NVIDIA GPU (8GB+ VRAM)
- Training time: ~24-48 hours
- Cost: $0 (if hardware available)

#### Training Monitoring

```python
# TensorBoard for visualization
from torch.utils.tensorboard import SummaryWriter
writer = SummaryWriter('runs/yolov8_blueprints')

# Log metrics
- Loss curves (box, cls, dfl)
- mAP@50 and mAP@50-95
- Precision and recall
- Learning rate schedule
```

### Week 6: Evaluation & Deployment

#### Model Evaluation

**Metrics:**
1. **mAP (Mean Average Precision)**
   - mAP@50: Target >85%
   - mAP@50-95: Target >70%

2. **Per-Class Metrics**
   - Precision, Recall, F1-score per room type
   - Confusion matrix analysis

3. **Speed**
   - Inference time per image: Target <500ms
   - Batch inference: Test with 10+ images

4. **A/B Testing**
   - Compare Phase 1 (OpenCV) vs Phase 2 (YOLO)
   - Use 100 test blueprints
   - Measure accuracy improvement

**Validation Script:**
```python
from ultralytics import YOLO
import numpy as np

model = YOLO('runs/train/weights/best.pt')

# Run validation
results = model.val(
    data='blueprint_dataset.yaml',
    split='test',
    imgsz=640,
    batch=16,
    save_json=True,
)

print(f"mAP@50: {results.box.map50:.3f}")
print(f"mAP@50-95: {results.box.map:.3f}")
```

#### Model Optimization

**Export for Deployment:**
```python
# Export to ONNX for faster inference
model.export(format='onnx', opset=13, simplify=True)

# Optional: TensorRT for even faster inference
model.export(format='engine', device=0)
```

**Quantization (Optional):**
- INT8 quantization for smaller model size
- Trade-off: 1-2% accuracy loss for 4x smaller model

#### Deployment Options

**Option A: AWS Lambda + Container**
- Package YOLO model in Docker container
- Use Lambda with ECR
- Pros: Serverless, auto-scaling
- Cons: Cold start (~3-5s), memory limit (10GB)
- **Cost**: ~$0.01-0.02 per request

**Option B: AWS SageMaker Real-Time Endpoint**
- Deploy as managed endpoint
- Pros: No cold starts, predictable latency
- Cons: Always-on cost, more expensive
- **Cost**: ~$0.10-0.20/hour (~$73-146/month)

**Option C: SageMaker Multi-Model Endpoint**
- Share endpoint across multiple models
- Pros: Cost-effective for low traffic
- Cons: Slightly higher latency
- **Cost**: ~$50-80/month

**Recommendation**: Start with Lambda + Container for MVP, migrate to SageMaker if traffic increases.

#### Deployment Steps

1. **Update Lambda Function**
   ```python
   # backend/lambda/room_detector_yolo.py
   from ultralytics import YOLO
   
   model = YOLO('best.onnx')  # Load optimized model
   
   def detect_rooms_yolo(image_bytes):
       results = model.predict(image_bytes, imgsz=640, conf=0.7)
       # Process results...
   ```

2. **Update CDK Stack**
   ```typescript
   // Increase Lambda memory for YOLO
   memorySize: 10240,  // 10GB
   timeout: cdk.Duration.seconds(30),
   environment: {
     MODEL_VERSION: 'phase_2_yolov8',
   }
   ```

3. **Deploy**
   ```bash
   cd backend/infrastructure
   cdk deploy
   ```

4. **A/B Testing**
   - Deploy both versions
   - Route 10% traffic to YOLO, 90% to OpenCV
   - Gradually increase YOLO traffic if metrics improve

## Success Criteria

| Metric | Phase 1 (OpenCV) | Phase 2 (YOLO) Target |
|--------|------------------|----------------------|
| **Accuracy (Rectangular Rooms)** | 75% | ≥85% |
| **Accuracy (Complex Rooms)** | 60% | ≥70% |
| **False Positive Rate** | 10% | <5% |
| **Inference Time** | 500ms | <500ms |
| **Cost per Blueprint** | $0.002 | <$0.05 |

## Risk Mitigation

### Risk 1: Insufficient Training Data
**Mitigation:**
- Start with smaller dataset (300 blueprints)
- Use transfer learning from pre-trained YOLO
- Apply aggressive data augmentation
- Consider synthetic data generation

### Risk 2: Poor Model Performance
**Mitigation:**
- Hyperparameter tuning with Optuna
- Try different YOLO variants (small, medium, large)
- Ensemble multiple models
- Fall back to OpenCV + YOLO hybrid

### Risk 3: High Inference Cost
**Mitigation:**
- Use model quantization
- Batch processing where possible
- Implement request caching
- Use SageMaker serverless inference

### Risk 4: Deployment Complexity
**Mitigation:**
- Test locally with Docker
- Use SageMaker for easier deployment
- Implement gradual rollout (canary deployment)
- Keep OpenCV as fallback

## Post-Deployment

### Monitoring
- Track accuracy metrics in production
- Log user feedback (accepted vs rejected detections)
- Monitor latency and cost

### Continuous Improvement
- Collect misdetections for retraining
- Quarterly model updates
- Expand dataset with production data

### Phase 3 Considerations
- Vision Transformers (if accuracy plateaus)
- Polygon detection (beyond bounding boxes)
- Room name detection with OCR
- Multi-floor blueprint support

## Resources

### Tools & Libraries
- [Ultralytics YOLO v8](https://github.com/ultralytics/ultralytics)
- [Roboflow](https://roboflow.com/) - Annotation platform
- [LabelImg](https://github.com/heartexlabs/labelImg) - Open-source alternative

### Datasets
- [CubiCasa5K](https://github.com/CubiCasa/CubiCasa5k)
- [RPLAN](http://staff.ustc.edu.cn/~fuxm/projects/DeepLayout/index.html)
- [FloorNet](https://github.com/art-programmer/FloorNet)

### Training Resources
- AWS SageMaker Training
- Google Colab Pro (GPU)
- Lambda Labs (Cloud GPU)
- Paperspace Gradient

## Budget

| Item | Cost |
|------|------|
| Data Annotation (Roboflow) | $100-200 |
| SageMaker Training | $50-80 |
| Model Storage (S3) | $5/month |
| SageMaker Endpoint (Optional) | $73-146/month |
| Total (One-time) | **$150-280** |
| Total (Monthly) | **$5-151** |

---

**Status**: Planning Phase  
**Owner**: Development Team  
**Timeline**: Weeks 4-6 after Phase 1 completion  
**Next Steps**: Complete Phase 1 MVP and validate with real blueprints

