# YOLOv8 Training for Room Detection

This directory contains the training infrastructure for YOLOv8-based room detection in floor plans.

## 🚀 Quick Start

```bash
# 1. Activate virtual environment
source venv/bin/activate

# 2. Run test training (already working!)
python scripts/train_yolo.py \
  --data datasets/quick_test/dataset.yaml \
  --epochs 10 \
  --model n

# 3. Download real dataset and train
# See TRAINING_GUIDE.md for details
```

## 📖 Documentation

- **[TRAINING_GUIDE.md](TRAINING_GUIDE.md)** - Complete training guide
- **requirements.txt** - Python dependencies
- **scripts/** - Training and dataset utilities

## ✅ Status

Training pipeline is **fully functional** and tested on Apple Silicon (MPS).

- ✅ YOLOv8 installed
- ✅ Test dataset created
- ✅ Training verified (mAP50: 0.995)
- ✅ Apple Silicon (MPS) support

## 🎯 Next Steps

1. Download a real floor plan dataset (CubiCasa5K or Roboflow)
2. Train for 100+ epochs
3. Integrate trained model with AWS Lambda backend

See **TRAINING_GUIDE.md** for detailed instructions!

