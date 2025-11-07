#!/usr/bin/env python3
"""
Download a public floor plan dataset from Roboflow Universe
No API key required for public datasets!
"""

import subprocess
import sys
from pathlib import Path

def download_from_roboflow_universe():
    """
    Download public floor plan dataset from Roboflow Universe
    """
    
    print("=" * 60)
    print("Downloading Public Floor Plan Dataset")
    print("=" * 60)
    
    # Public dataset on Roboflow Universe (no API key needed)
    # This is an example - you can find more at universe.roboflow.com
    
    print("""
OPTIONS:

1. CUBICASA-LIKE DATASET (Recommended):
   Visit: https://universe.roboflow.com
   Search: "floor plan" or "room detection"
   Select a public dataset
   Copy the curl download command or pip install command

2. DOWNLOAD MANUALLY:
   - Go to: https://universe.roboflow.com
   - Search for "floor plan" datasets
   - Choose one with YOLOv8 format
   - Download (no account needed for public datasets)
   - Extract to: training/datasets/downloaded/

3. USE EXAMPLE COMMAND:
   Some public datasets provide direct download:
""")
    
    example_download = '''
# Example: Download using curl (if dataset provides public link)
curl -L "https://universe.roboflow.com/..." -o floor_plans.zip
unzip floor_plans.zip -d datasets/downloaded/
'''
    
    print(example_download)
    print("\n" + "=" * 60)
    
def download_sample_images():
    """
    Download a few sample floor plan images for quick testing
    """
    import requests
    from PIL import Image
    from io import BytesIO
    import cv2
    import numpy as np
    
    output_dir = Path("datasets/quick_test/images/train")
    labels_dir = Path("datasets/quick_test/labels/train")
    output_dir.mkdir(parents=True, exist_ok=True)
    labels_dir.mkdir(parents=True, exist_ok=True)
    
    print("\n📥 Creating a minimal test dataset...")
    
    # Create a simple synthetic floor plan for testing
    # This is just for testing the training pipeline
    for i in range(5):
        # Create a blank floor plan
        img = np.ones((1000, 1000, 3), dtype=np.uint8) * 255
        
        # Draw walls
        cv2.rectangle(img, (100, 100), (900, 900), (0, 0, 0), 5)
        cv2.line(img, (500, 100), (500, 900), (0, 0, 0), 5)  # Vertical wall
        cv2.line(img, (100, 500), (900, 500), (0, 0, 0), 5)  # Horizontal wall
        
        # Add some noise to make each image unique
        noise = np.random.randint(-10, 10, img.shape, dtype=np.int16)
        img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        
        # Save image
        image_path = output_dir / f"test_floor_plan_{i:03d}.jpg"
        cv2.imwrite(str(image_path), img)
        
        # Create labels (4 rooms in a 2x2 grid)
        label_path = labels_dir / f"test_floor_plan_{i:03d}.txt"
        with open(label_path, 'w') as f:
            # Format: class x_center y_center width height (normalized to 0-1)
            # Room 1 (top-left)
            f.write("0 0.300 0.300 0.380 0.380\n")
            # Room 2 (top-right)
            f.write("0 0.700 0.300 0.380 0.380\n")
            # Room 3 (bottom-left)
            f.write("0 0.300 0.700 0.380 0.380\n")
            # Room 4 (bottom-right)
            f.write("0 0.700 0.700 0.380 0.380\n")
    
    # Create validation set (1 image)
    val_img_dir = Path("datasets/quick_test/images/val")
    val_lbl_dir = Path("datasets/quick_test/labels/val")
    val_img_dir.mkdir(parents=True, exist_ok=True)
    val_lbl_dir.mkdir(parents=True, exist_ok=True)
    
    img = np.ones((1000, 1000, 3), dtype=np.uint8) * 255
    cv2.rectangle(img, (100, 100), (900, 900), (0, 0, 0), 5)
    cv2.line(img, (500, 100), (500, 900), (0, 0, 0), 5)
    cv2.line(img, (100, 500), (900, 500), (0, 0, 0), 5)
    
    cv2.imwrite(str(val_img_dir / "val_floor_plan.jpg"), img)
    
    with open(val_lbl_dir / "val_floor_plan.txt", 'w') as f:
        f.write("0 0.300 0.300 0.380 0.380\n")
        f.write("0 0.700 0.300 0.380 0.380\n")
        f.write("0 0.300 0.700 0.380 0.380\n")
        f.write("0 0.700 0.700 0.380 0.380\n")
    
    # Create dataset.yaml
    import yaml
    
    yaml_content = {
        'path': str(Path("datasets/quick_test").absolute()),
        'train': 'images/train',
        'val': 'images/val',
        'names': {
            0: 'room',
        },
        'nc': 1  # number of classes
    }
    
    yaml_path = Path("datasets/quick_test/dataset.yaml")
    with open(yaml_path, 'w') as f:
        yaml.dump(yaml_content, f, default_flow_style=False)
    
    print(f"✓ Created minimal test dataset at: datasets/quick_test/")
    print(f"  - 5 training images")
    print(f"  - 1 validation image")
    print(f"\n▶ You can now test training with:")
    print(f"  python scripts/train_yolo.py --data {yaml_path} --epochs 10 --model n")
    
    return yaml_path

if __name__ == '__main__':
    print("Floor Plan Dataset Downloader")
    print("=" * 60)
    
    choice = input("\nWhat would you like to do?\n"
                  "1. Download instructions for real dataset\n"
                  "2. Create minimal synthetic test dataset\n"
                  "Choice (1 or 2): ").strip()
    
    if choice == '1':
        download_from_roboflow_universe()
    elif choice == '2':
        download_sample_images()
        print("\n✅ Test dataset ready! You can now run training.")
    else:
        print("Invalid choice. Creating test dataset...")
        download_sample_images()

