#!/usr/bin/env python3
"""
Download and prepare CubiCasa5K dataset for YOLOv8 training
CubiCasa5K: 5000+ floor plans with room annotations
"""

import os
import requests
import zipfile
import json
from pathlib import Path
from tqdm import tqdm
import shutil

def download_file(url: str, dest_path: Path):
    """Download file with progress bar"""
    response = requests.get(url, stream=True)
    total_size = int(response.headers.get('content-length', 0))
    
    with open(dest_path, 'wb') as f, tqdm(
        desc=dest_path.name,
        total=total_size,
        unit='iB',
        unit_scale=True,
    ) as pbar:
        for chunk in response.iter_content(chunk_size=8192):
            size = f.write(chunk)
            pbar.update(size)

def download_cubicasa5k(output_dir: Path):
    """
    Download CubiCasa5K dataset
    
    Note: Full dataset is ~5GB. This script provides instructions.
    """
    print("=" * 60)
    print("CubiCasa5K Dataset Download Instructions")
    print("=" * 60)
    
    print("""
The CubiCasa5K dataset contains 5000+ floor plans with room annotations.

OPTION 1: Download from Official Source
---------------------------------------
1. Visit: https://github.com/CubiCasa/CubiCasa5k
2. Follow their download instructions
3. Extract to: training/datasets/cubicasa5k/

OPTION 2: Download Subset (for testing)
---------------------------------------
We'll use a smaller subset for initial training.

OPTION 3: Use Roboflow (Easiest)
--------------------------------
1. Sign up at: https://roboflow.com (free)
2. Search for "floor plan" or "room detection" datasets
3. Export as YOLOv8 format
4. Download API key and use download_roboflow.py script

Full CubiCasa5K download will take ~30-60 minutes depending on connection.
""")
    
    # Create directories
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\nDataset directory created: {output_dir}")
    print("\nNext steps:")
    print("1. Download dataset using one of the options above")
    print("2. Run: python scripts/prepare_yolo_dataset.py")
    print("3. Run: python scripts/train_yolo.py")
    
    return output_dir

if __name__ == '__main__':
    # Set up paths
    project_root = Path(__file__).parent.parent
    dataset_dir = project_root / 'datasets' / 'cubicasa5k'
    
    download_cubicasa5k(dataset_dir)

