#!/usr/bin/env python3
"""
Create a realistic floor plan dataset with variety
"""

import cv2
import numpy as np
from pathlib import Path
import random
import yaml

def create_floor_plan_image(width=1000, height=1000, num_rooms=None):
    """Create a realistic floor plan with rooms"""
    
    # White background
    img = np.ones((height, width, 3), dtype=np.uint8) * 255
    
    # Random number of rooms if not specified
    if num_rooms is None:
        num_rooms = random.randint(2, 6)
    
    # Draw outer walls
    wall_thickness = 10
    cv2.rectangle(img, (50, 50), (width-50, height-50), (0, 0, 0), wall_thickness)
    
    rooms = []
    
    if num_rooms == 2:
        # Vertical split
        cv2.line(img, (width//2, 50), (width//2, height-50), (0, 0, 0), wall_thickness)
        rooms = [
            (0.30, 0.50, 0.40, 0.85),  # Left room
            (0.70, 0.50, 0.40, 0.85),  # Right room
        ]
    
    elif num_rooms == 3:
        # L-shape layout
        cv2.line(img, (width//2, 50), (width//2, height-50), (0, 0, 0), wall_thickness)
        cv2.line(img, (50, height//2), (width//2, height//2), (0, 0, 0), wall_thickness)
        rooms = [
            (0.30, 0.30, 0.40, 0.35),  # Top left
            (0.30, 0.75, 0.40, 0.35),  # Bottom left
            (0.70, 0.50, 0.40, 0.85),  # Right
        ]
    
    elif num_rooms == 4:
        # 2x2 grid
        cv2.line(img, (width//2, 50), (width//2, height-50), (0, 0, 0), wall_thickness)
        cv2.line(img, (50, height//2), (width-50, height//2), (0, 0, 0), wall_thickness)
        rooms = [
            (0.30, 0.30, 0.35, 0.35),  # Top left
            (0.70, 0.30, 0.35, 0.35),  # Top right
            (0.30, 0.70, 0.35, 0.35),  # Bottom left
            (0.70, 0.70, 0.35, 0.35),  # Bottom right
        ]
    
    elif num_rooms == 5:
        # 2x2 + hallway
        cv2.line(img, (width//3, 50), (width//3, height-50), (0, 0, 0), wall_thickness)
        cv2.line(img, (2*width//3, 50), (2*width//3, height-50), (0, 0, 0), wall_thickness)
        cv2.line(img, (50, height//2), (width-50, height//2), (0, 0, 0), wall_thickness)
        rooms = [
            (0.22, 0.30, 0.25, 0.35),  # Top left
            (0.50, 0.30, 0.25, 0.35),  # Top middle
            (0.78, 0.30, 0.25, 0.35),  # Top right
            (0.22, 0.70, 0.25, 0.35),  # Bottom left
            (0.50, 0.70, 0.25, 0.35),  # Bottom middle
        ]
    
    else:  # 6 rooms
        # 2x3 grid
        cv2.line(img, (width//2, 50), (width//2, height-50), (0, 0, 0), wall_thickness)
        cv2.line(img, (50, height//3), (width-50, height//3), (0, 0, 0), wall_thickness)
        cv2.line(img, (50, 2*height//3), (width-50, 2*height//3), (0, 0, 0), wall_thickness)
        rooms = [
            (0.30, 0.22, 0.35, 0.23),  # Top left
            (0.70, 0.22, 0.35, 0.23),  # Top right
            (0.30, 0.50, 0.35, 0.23),  # Middle left
            (0.70, 0.50, 0.35, 0.23),  # Middle right
            (0.30, 0.78, 0.35, 0.23),  # Bottom left
            (0.70, 0.78, 0.35, 0.23),  # Bottom right
        ]
    
    # Add some random variations
    noise_level = random.randint(5, 15)
    noise = np.random.randint(-noise_level, noise_level, img.shape, dtype=np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    
    # Add some random lines (doors, windows)
    for _ in range(random.randint(2, 5)):
        x1 = random.randint(100, width-100)
        y1 = random.randint(100, height-100)
        x2 = x1 + random.randint(-50, 50)
        y2 = y1 + random.randint(-50, 50)
        cv2.line(img, (x1, y1), (x2, y2), (128, 128, 128), 2)
    
    return img, rooms

def create_dataset(output_dir, num_train=50, num_val=10):
    """Create a realistic dataset"""
    
    output_dir = Path(output_dir)
    
    # Create directories
    train_img_dir = output_dir / "images" / "train"
    train_lbl_dir = output_dir / "labels" / "train"
    val_img_dir = output_dir / "images" / "val"
    val_lbl_dir = output_dir / "labels" / "val"
    
    for dir in [train_img_dir, train_lbl_dir, val_img_dir, val_lbl_dir]:
        dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Creating realistic floor plan dataset...")
    print(f"  Training images: {num_train}")
    print(f"  Validation images: {num_val}")
    
    # Create training set
    for i in range(num_train):
        img, rooms = create_floor_plan_image()
        
        # Save image
        img_path = train_img_dir / f"floor_plan_{i:04d}.jpg"
        cv2.imwrite(str(img_path), img)
        
        # Save labels
        lbl_path = train_lbl_dir / f"floor_plan_{i:04d}.txt"
        with open(lbl_path, 'w') as f:
            for room in rooms:
                f.write(f"0 {room[0]:.6f} {room[1]:.6f} {room[2]:.6f} {room[3]:.6f}\n")
        
        if (i + 1) % 10 == 0:
            print(f"  Created {i + 1}/{num_train} training images")
    
    # Create validation set
    for i in range(num_val):
        img, rooms = create_floor_plan_image()
        
        # Save image
        img_path = val_img_dir / f"val_floor_plan_{i:04d}.jpg"
        cv2.imwrite(str(img_path), img)
        
        # Save labels
        lbl_path = val_lbl_dir / f"val_floor_plan_{i:04d}.txt"
        with open(lbl_path, 'w') as f:
            for room in rooms:
                f.write(f"0 {room[0]:.6f} {room[1]:.6f} {room[2]:.6f} {room[3]:.6f}\n")
    
    print(f"  Created {num_val} validation images")
    
    # Create dataset.yaml
    yaml_content = {
        'path': str(output_dir.absolute()),
        'train': 'images/train',
        'val': 'images/val',
        'names': {
            0: 'room',
        },
        'nc': 1
    }
    
    yaml_path = output_dir / 'dataset.yaml'
    with open(yaml_path, 'w') as f:
        yaml.dump(yaml_content, f, default_flow_style=False)
    
    print(f"\n✅ Dataset created at: {output_dir}")
    print(f"   Dataset YAML: {yaml_path}")
    
    return yaml_path

if __name__ == '__main__':
    yaml_path = create_dataset(
        output_dir="datasets/realistic_floorplans",
        num_train=50,
        num_val=10
    )
    
    print(f"\n🚀 Ready to train!")
    print(f"   python scripts/train_yolo.py --data {yaml_path} --epochs 100 --model n")

