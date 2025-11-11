# 🚀 Upgrading to YOLOv8m with Real Data

## 📋 Preparation Checklist

### 1. Dataset Format
Your training data should follow this structure:

```
training/datasets/YOUR_DATASET_NAME/
├── images/
│   ├── train/          # Your training images (.jpg, .png)
│   ├── val/            # Validation images (10-20% of data)
│   └── test/           # Optional test set
├── labels/
│   ├── train/          # YOLO format annotations (.txt)
│   ├── val/            # Validation annotations
│   └── test/           # Optional test annotations
└── dataset.yaml        # Dataset configuration
```

### 2. Annotation Format

**Standard YOLO Detection (Recommended for Floor Plans)**:
```
class_id x_center y_center width height
```

All values normalized to 0-1:
- `x_center`: Room center X / image width
- `y_center`: Room center Y / image height
- `width`: Room width / image width
- `height`: Room height / image height

**Example label file** (`floor_plan_001.txt`):
```
0 0.5 0.3 0.4 0.5
0 0.2 0.7 0.3 0.4
0 0.8 0.3 0.15 0.25
```

### 3. Dataset YAML

Create `dataset.yaml` in your dataset folder:

```yaml
# Path to dataset root (absolute path)
path: /Users/nat/roomdetection/training/datasets/YOUR_DATASET_NAME

# Relative paths from 'path'
train: images/train
val: images/val
test: images/test  # Optional

# Class names
names:
  0: room
  # Optional: Add room types if you want classification
  # 1: bedroom
  # 2: bathroom
  # 3: kitchen
  # 4: living_room

# Number of classes
nc: 1  # Change if you have multiple room types
```

---

## 🎯 Training Command for YOLOv8m

Once your data is ready, run:

```bash
cd /Users/nat/roomdetection/training
source venv/bin/activate

python scripts/train_yolo.py \
  --data datasets/YOUR_DATASET_NAME/dataset.yaml \
  --epochs 150 \
  --batch 8 \
  --img-size 640 \
  --model m \
  --name yolov8m_real_data_v1
```

### Training Parameters Explained:

- `--data`: Path to your dataset.yaml
- `--epochs 150`: More epochs for real data (vs 100 for synthetic)
- `--batch 8`: Batch size (reduce to 4 if out of memory)
- `--img-size 640`: Image size (increase to 1024 for high-res blueprints)
- `--model m`: YOLOv8 Medium (26M parameters)
- `--name`: Training run name (creates folder in `room_detection/`)

---

## 📊 Expected Performance

### YOLOv8m vs YOLOv8n:

| Metric | YOLOv8n (Current) | YOLOv8m (Upgrade) |
|--------|-------------------|-------------------|
| **Parameters** | 3M | 26M |
| **Model Size** | 18 MB | ~52 MB |
| **Accuracy** | 99.1% (synthetic) | 85-95% (real data) |
| **Inference Time** | ~5-7s | ~8-12s |
| **Complex Layouts** | ⚠️ May struggle | ✅ Excellent |
| **Robustness** | Medium | High |

---

## 🔧 Advanced Options

### High-Resolution Blueprints
If your blueprints are large (>2000px):
```bash
python scripts/train_yolo.py \
  --data datasets/YOUR_DATASET_NAME/dataset.yaml \
  --epochs 150 \
  --batch 4 \
  --img-size 1024 \
  --model m \
  --name yolov8m_highres_v1
```

### Room Type Classification
If you annotated different room types:
```bash
# Make sure dataset.yaml has multiple classes:
# nc: 5
# names:
#   0: bedroom
#   1: bathroom
#   2: kitchen
#   3: living_room
#   4: other

python scripts/train_yolo.py \
  --data datasets/YOUR_DATASET_NAME/dataset.yaml \
  --epochs 200 \
  --batch 8 \
  --model m \
  --name yolov8m_classified_v1
```

---

## 📁 Where to Put Your Data

### Option 1: Create New Dataset Folder
```bash
cd /Users/nat/roomdetection/training
mkdir -p datasets/real_floorplans/images/train
mkdir -p datasets/real_floorplans/images/val
mkdir -p datasets/real_floorplans/labels/train
mkdir -p datasets/real_floorplans/labels/val
```

Then:
1. Copy your images to `datasets/real_floorplans/images/train/`
2. Copy your labels to `datasets/real_floorplans/labels/train/`
3. Split 10-20% to validation folders
4. Create `dataset.yaml` (see template above)

### Option 2: Use Roboflow Export
If you're using Roboflow for annotation:
1. Export as "YOLOv8" format
2. Download and extract to `training/datasets/`
3. It will include dataset.yaml automatically
4. Train directly!

---

## ⚙️ Annotation Tools

### Recommended Tools:

1. **Roboflow** (Easiest) ⭐
   - Web-based, no install
   - Auto-exports to YOLOv8 format
   - Team collaboration
   - https://roboflow.com

2. **LabelImg** (Desktop)
   - Free, open-source
   - Works offline
   - Exports to YOLO format
   - https://github.com/tzutalin/labelImg

3. **CVAT** (Advanced)
   - Self-hosted or cloud
   - Multiple annotators
   - https://cvat.ai

---

## 🎓 Annotation Tips for Floor Plans

1. **Draw tight boxes** around each room
2. **Include the walls** in the bounding box
3. **Exclude hallways** if <5m² (or create separate class)
4. **Handle overlapping spaces** by choosing primary function
5. **Be consistent** with room boundaries
6. **Annotate all visible rooms** (100% coverage)

### Good Annotation:
```
┌─────────────────┐
│  ┌──────────┐   │
│  │  ROOM 1  │   │  ← Box includes walls
│  └──────────┘   │
│                 │
│  ┌──────────┐   │
│  │  ROOM 2  │   │
│  └──────────┘   │
└─────────────────┘
```

### Bad Annotation:
```
┌─────────────────┐
│  ┌──────────┐   │
│  │ ROOM 1   │   │  ← Box too small, cuts walls
│  └─────────┘    │
│                 │
│    ┌────────┐   │  ← Skipped this room
│    │        │   │
│    └────────┘   │
└─────────────────┘
```

---

## 📈 Training Progress

Training will take **2-4 hours** depending on dataset size.

Monitor in real-time:
```bash
# In another terminal
cd /Users/nat/roomdetection/training
source venv/bin/activate
python scripts/monitor_training.py
```

Or check results:
```bash
# View training curves
open room_detection/yolov8m_real_data_v1/results.png

# Check best model
ls -lh room_detection/yolov8m_real_data_v1/weights/best.pt
```

---

## 🚀 After Training

### 1. Test the Model
```bash
yolo predict \
  model=room_detection/yolov8m_real_data_v1/weights/best.pt \
  source=path/to/test_image.jpg \
  save=True
```

### 2. Validate Performance
```bash
yolo val \
  model=room_detection/yolov8m_real_data_v1/weights/best.pt \
  data=datasets/YOUR_DATASET_NAME/dataset.yaml
```

### 3. Deploy to ECS
```bash
# Copy new model to yolo-service
cp room_detection/yolov8m_real_data_v1/weights/best.pt \
   ../backend/yolo-service/yolov8_room_detector.pt

# Rebuild and deploy
cd ../backend/infrastructure
npm run deploy:yolo
```

---

## 📊 Minimum Dataset Recommendations

| Dataset Size | Expected Accuracy | Use Case |
|--------------|-------------------|----------|
| 50-100 images | 70-80% | Quick test |
| 100-300 images | 80-90% | Good baseline |
| 300-1000 images | 90-95% | Production ready ⭐ |
| 1000+ images | 95-99% | Enterprise grade |

**Recommended**: Start with **300-500 annotated floor plans** for production.

---

## 🎯 Next Steps

1. **Prepare your training data** in the format above
2. **Let me know when ready** - I'll help you:
   - Validate the dataset structure
   - Create the dataset.yaml
   - Run the training command
   - Monitor progress
   - Deploy the new model

3. **Share details**:
   - How many images do you have?
   - Are they annotated already?
   - Single class (room) or multiple classes (bedroom, kitchen, etc.)?
   - Image resolution/quality?

---

## 💡 Pro Tips

1. **Start small**: Test with 50-100 images first
2. **Validate annotations**: Check a few manually before training
3. **Use augmentation**: YOLOv8 does this automatically
4. **Monitor overfitting**: Watch validation loss vs training loss
5. **Save checkpoints**: Model saves every 10 epochs automatically
6. **Compare models**: Keep YOLOv8n as baseline, compare with YOLOv8m

---

**Ready to start? Let me know when you have the data ready!** 🚀

