#!/usr/bin/env python3
"""
Monitor YOLO training progress
"""

import time
from pathlib import Path
import sys

def monitor_training(project="room_detection", name="production_v1"):
    """Monitor training progress by watching the results file"""
    
    results_dir = Path(project) / name
    results_file = results_dir / "results.csv"
    
    print(f"Monitoring training: {results_dir}")
    print("=" * 60)
    
    if not results_dir.exists():
        print(f"Training directory not found: {results_dir}")
        print("Training may not have started yet...")
        return
    
    # Wait for results file
    wait_time = 0
    while not results_file.exists() and wait_time < 60:
        time.sleep(1)
        wait_time += 1
        if wait_time % 10 == 0:
            print(f"Waiting for training to start... ({wait_time}s)")
    
    if not results_file.exists():
        print("Results file not created yet. Training may be starting up...")
        return
    
    print(f"\n📊 Training Progress:\n")
    
    last_line_count = 0
    try:
        while True:
            if results_file.exists():
                with open(results_file, 'r') as f:
                    lines = f.readlines()
                
                if len(lines) > last_line_count:
                    # Print header if first time
                    if last_line_count == 0 and len(lines) > 0:
                        print(lines[0].strip())
                    
                    # Print new lines
                    for line in lines[last_line_count + 1:]:
                        if line.strip():
                            parts = line.strip().split(',')
                            if len(parts) >= 4:
                                epoch = parts[0].strip()
                                try:
                                    # Extract key metrics
                                    train_loss = float(parts[2]) if len(parts) > 2 else 0
                                    val_loss = float(parts[3]) if len(parts) > 3 else 0
                                    map50 = float(parts[-2]) if len(parts) > 10 else 0
                                    
                                    print(f"Epoch {epoch}: train_loss={train_loss:.4f}, "
                                          f"val_loss={val_loss:.4f}, mAP50={map50:.4f}")
                                except:
                                    print(line.strip())
                    
                    last_line_count = len(lines)
            
            time.sleep(2)
    
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped.")
        print(f"\nTraining logs: {results_dir}")
        print(f"Best model: {results_dir / 'weights' / 'best.pt'}")

if __name__ == '__main__':
    project = sys.argv[1] if len(sys.argv) > 1 else "room_detection"
    name = sys.argv[2] if len(sys.argv) > 2 else "production_v1"
    
    monitor_training(project, name)

