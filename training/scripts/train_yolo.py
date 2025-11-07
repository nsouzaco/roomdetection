#!/usr/bin/env python3
"""
Train YOLOv8 model for room detection in floor plans
"""

import argparse
from pathlib import Path
from ultralytics import YOLO
import torch

def train_yolo(
    data_yaml: str,
    model_size: str = 'n',
    epochs: int = 100,
    batch_size: int = 16,
    img_size: int = 640,
    device: str = None,
    project: str = 'room_detection',
    name: str = 'yolov8_rooms_v1',
):
    """
    Train YOLOv8 model
    
    Args:
        data_yaml: Path to dataset.yaml file
        model_size: n, s, m, l, x (nano to extra-large)
        epochs: Number of training epochs
        batch_size: Batch size for training
        img_size: Input image size
        device: Device to use (cuda:0, cpu, or mps for Mac)
        project: Project name for saving results
        name: Run name for this training session
    """
    
    print("=" * 60)
    print(f"YOLOv8{model_size.upper()} Room Detection Training")
    print("=" * 60)
    
    # Auto-detect device
    if device is None:
        if torch.cuda.is_available():
            device = '0'  # Use first GPU
            print(f"✓ Using GPU: {torch.cuda.get_device_name(0)}")
        elif torch.backends.mps.is_available():
            device = 'mps'  # Use Apple Silicon
            print("✓ Using Apple Silicon (MPS)")
        else:
            device = 'cpu'
            print("⚠ Using CPU (training will be slower)")
    
    # Load pretrained model
    model_name = f'yolov8{model_size}.pt'
    print(f"\n📦 Loading pretrained {model_name}...")
    model = YOLO(model_name)
    
    # Training configuration
    print(f"\n🎯 Training Configuration:")
    print(f"  - Dataset: {data_yaml}")
    print(f"  - Epochs: {epochs}")
    print(f"  - Batch size: {batch_size}")
    print(f"  - Image size: {img_size}")
    print(f"  - Device: {device}")
    
    # Start training
    print(f"\n🚀 Starting training...")
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=img_size,
        batch=batch_size,
        device=device,
        project=project,
        name=name,
        
        # Optimization
        optimizer='AdamW',
        lr0=0.001,
        lrf=0.01,
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=3,
        warmup_momentum=0.8,
        warmup_bias_lr=0.1,
        
        # Augmentation (important for floor plans)
        hsv_h=0.015,      # HSV hue augmentation
        hsv_s=0.7,        # HSV saturation augmentation
        hsv_v=0.4,        # HSV value augmentation
        degrees=10,       # Rotation degrees
        translate=0.1,    # Translation
        scale=0.5,        # Scale
        shear=0.0,        # Shear
        perspective=0.0,  # Perspective
        flipud=0.5,       # Flip up-down
        fliplr=0.5,       # Flip left-right
        mosaic=1.0,       # Mosaic augmentation
        mixup=0.1,        # Mixup augmentation
        
        # Training settings
        patience=20,      # Early stopping patience
        save=True,        # Save checkpoints
        save_period=10,   # Save every N epochs
        plots=True,       # Generate training plots
        verbose=True,     # Verbose output
        
        # Validation
        val=True,         # Validate during training
        split='val',      # Validation split
    )
    
    # Validation
    print(f"\n✅ Training complete!")
    print(f"\n📊 Evaluating model...")
    metrics = model.val()
    
    print(f"\n📈 Results:")
    print(f"  - mAP50: {metrics.box.map50:.3f}")
    print(f"  - mAP50-95: {metrics.box.map:.3f}")
    print(f"  - Precision: {metrics.box.mp:.3f}")
    print(f"  - Recall: {metrics.box.mr:.3f}")
    
    # Export model
    print(f"\n📤 Exporting model...")
    export_path = model.export(format='onnx')
    print(f"  - ONNX model: {export_path}")
    
    # Save path
    save_path = Path(project) / name / 'weights' / 'best.pt'
    print(f"\n💾 Model saved to: {save_path}")
    print(f"\nTo use this model:")
    print(f"  model = YOLO('{save_path}')")
    print(f"  results = model('blueprint.jpg')")
    
    return results, metrics

def main():
    parser = argparse.ArgumentParser(description='Train YOLOv8 for room detection')
    parser.add_argument('--data', type=str, required=True, help='Path to dataset.yaml')
    parser.add_argument('--model', type=str, default='n', choices=['n', 's', 'm', 'l', 'x'],
                       help='Model size (n=nano, s=small, m=medium, l=large, x=xlarge)')
    parser.add_argument('--epochs', type=int, default=100, help='Number of epochs')
    parser.add_argument('--batch', type=int, default=16, help='Batch size')
    parser.add_argument('--img-size', type=int, default=640, help='Image size')
    parser.add_argument('--device', type=str, default=None, help='Device (cuda:0, cpu, mps)')
    parser.add_argument('--project', type=str, default='room_detection', help='Project name')
    parser.add_argument('--name', type=str, default='yolov8_rooms_v1', help='Run name')
    
    args = parser.parse_args()
    
    train_yolo(
        data_yaml=args.data,
        model_size=args.model,
        epochs=args.epochs,
        batch_size=args.batch,
        img_size=args.img_size,
        device=args.device,
        project=args.project,
        name=args.name,
    )

if __name__ == '__main__':
    main()

