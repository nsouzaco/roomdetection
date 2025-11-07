#!/usr/bin/env python3
"""
Download floor plan dataset from Roboflow
This is the easiest way to get started with annotated data
"""

from roboflow import Roboflow
from pathlib import Path
import sys

def download_roboflow_dataset(api_key: str, workspace: str, project: str, version: int):
    """
    Download dataset from Roboflow
    
    Args:
        api_key: Your Roboflow API key
        workspace: Workspace name
        project: Project name
        version: Dataset version
    """
    print("Downloading from Roboflow...")
    
    # Initialize Roboflow
    rf = Roboflow(api_key=api_key)
    project = rf.workspace(workspace).project(project)
    dataset = project.version(version).download("yolov8")
    
    print(f"\nDataset downloaded to: {dataset.location}")
    print("\nDataset structure:")
    print(f"  - Train images: {dataset.location}/train/images")
    print(f"  - Val images: {dataset.location}/valid/images")
    print(f"  - Test images: {dataset.location}/test/images")
    
    return dataset.location

def use_public_floor_plan_dataset():
    """
    Use a public floor plan dataset from Roboflow Universe
    
    Example datasets available:
    - "floor-plan-object-detection" by various authors
    - "room-detection" datasets
    """
    print("""
To use a public Roboflow dataset:

1. Go to: https://universe.roboflow.com
2. Search for: "floor plan" or "room detection"
3. Find a dataset you like
4. Click "Download Dataset"
5. Select "YOLOv8" format
6. Get your API key from: https://app.roboflow.com/settings/api
7. Copy the code snippet provided

Example:
--------
from roboflow import Roboflow
rf = Roboflow(api_key="YOUR_API_KEY")
project = rf.workspace("workspace-name").project("project-name")
dataset = project.version(1).download("yolov8")

Then run this script with your credentials.
""")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
        print(f"Using API key: {api_key[:10]}...")
        
        # Example: Download a public dataset
        # You'll need to replace these with actual values
        workspace = "your-workspace"
        project = "floor-plan-detection"
        version = 1
        
        try:
            location = download_roboflow_dataset(api_key, workspace, project, version)
            print(f"\n✅ Dataset ready at: {location}")
        except Exception as e:
            print(f"\n❌ Error: {e}")
            print("\nMake sure to update workspace/project/version in the script")
    else:
        use_public_floor_plan_dataset()

