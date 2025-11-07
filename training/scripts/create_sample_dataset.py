#!/usr/bin/env python3
"""
Create a sample dataset from free floor plan images
Downloads from public sources and creates YOLO format annotations
"""

import os
import requests
from pathlib import Path
import shutil
import yaml
from tqdm import tqdm

def download_sample_floor_plans():
    """
    Download sample floor plans from public sources
    
    These are simplified floor plans for initial training/testing
    """
    
    # Sample floor plan URLs (public domain / free to use)
    sample_urls = [
        "https://raw.githubusercontent.com/CubiCasa/CubiCasa5k/master/example_data/F3_scaled.png",
        # Add more public floor plan URLs here
    ]
    
    output_dir = Path("datasets/sample")
    images_dir = output_dir / "images" / "train"
    labels_dir = output_dir / "labels" / "train"
    
    images_dir.mkdir(parents=True, exist_ok=True)
    labels_dir.mkdir(parents=True, exist_ok=True)
    
    print("Downloading sample floor plans...")
    
    for idx, url in enumerate(tqdm(sample_urls)):
        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                image_path = images_dir / f"floor_plan_{idx:03d}.png"
                with open(image_path, 'wb') as f:
                    f.write(response.content)
                
                # Create empty label file (you'll need to annotate these)
                label_path = labels_dir / f"floor_plan_{idx:03d}.txt"
                label_path.touch()
                
                print(f"✓ Downloaded: {image_path.name}")
        except Exception as e:
            print(f"✗ Failed to download {url}: {e}")
    
    return output_dir

def create_dataset_yaml(dataset_dir: Path):
    """Create dataset.yaml for YOLO training"""
    
    yaml_content = {
        'path': str(dataset_dir.absolute()),
        'train': 'images/train',
        'val': 'images/val',
        'test': 'images/test',
        'names': {
            0: 'room',
            1: 'bathroom',
            2: 'bedroom',
            3: 'kitchen',
            4: 'living_room',
            5: 'dining_room',
            6: 'hallway',
            7: 'closet',
        },
        'nc': 8  # number of classes
    }
    
    yaml_path = dataset_dir / 'dataset.yaml'
    with open(yaml_path, 'w') as f:
        yaml.dump(yaml_content, f, default_flow_style=False)
    
    print(f"\n✓ Created dataset.yaml at: {yaml_path}")
    return yaml_path

def print_instructions(dataset_dir: Path):
    """Print instructions for manual annotation"""
    
    print("\n" + "=" * 60)
    print("DATASET CREATED - NEXT STEPS")
    print("=" * 60)
    print(f"""
Your dataset structure:
{dataset_dir}/
  ├── images/
  │   └── train/         # Place your floor plan images here
  │   └── val/           # Validation images (20% of total)
  │   └── test/          # Test images (10% of total)
  ├── labels/
  │   └── train/         # YOLO format labels (.txt files)
  │   └── val/
  │   └── test/
  └── dataset.yaml       # Dataset configuration

ANNOTATION OPTIONS:

1. Use Roboflow (Easiest - Cloud-based):
   - Upload images to roboflow.com
   - Draw bounding boxes around rooms
   - Export as YOLOv8 format
   - Download and replace this folder

2. Use LabelImg (Desktop Tool):
   - Install: pip install labelImg
   - Run: labelImg
   - Open: {dataset_dir / 'images' / 'train'}
   - Draw boxes and save as YOLO format

3. Use existing dataset (Recommended):
   - Download CubiCasa5K: https://github.com/CubiCasa/CubiCasa5k
   - Or use Roboflow Universe public datasets

YOLO Label Format:
Each .txt file contains one line per object:
<class_id> <x_center> <y_center> <width> <height>
All values normalized to 0-1 range.

Example:
0 0.5 0.3 0.2 0.4  # room at center-top
1 0.1 0.1 0.15 0.2  # bathroom at top-left

After annotation, run training:
python scripts/train_yolo.py --data {dataset_dir / 'dataset.yaml'}
""")

if __name__ == '__main__':
    # Create directory structure
    dataset_dir = Path("datasets/sample")
    
    # Create all subdirectories
    for split in ['train', 'val', 'test']:
        (dataset_dir / 'images' / split).mkdir(parents=True, exist_ok=True)
        (dataset_dir / 'labels' / split).mkdir(parents=True, exist_ok=True)
    
    # Download samples (commented out - requires valid URLs)
    # download_sample_floor_plans()
    
    # Create dataset.yaml
    yaml_path = create_dataset_yaml(dataset_dir)
    
    # Print instructions
    print_instructions(dataset_dir)
    
    print(f"\n✓ Dataset structure created at: {dataset_dir.absolute()}")
    print("\n📝 Add your floor plan images and annotations, then start training!")

