#!/bin/bash

# Download sample blueprints for testing

echo "📥 Downloading Sample Blueprints for Testing"
echo "============================================="
echo ""

# Create test directory
mkdir -p test-blueprints
cd test-blueprints

echo "Downloading sample architectural blueprints..."
echo ""

# Sample 1: Simple floor plan
echo "1. Simple residential floor plan..."
curl -L -o "sample-1-residential.png" \
  "https://raw.githubusercontent.com/art-programmer/FloorplanTransformation/master/floorplan.png" \
  2>/dev/null || echo "  ⚠️  Failed to download sample 1"

# Sample 2: Office layout
echo "2. Office layout blueprint..."
curl -L -o "sample-2-office.jpg" \
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80" \
  2>/dev/null || echo "  ⚠️  Failed to download sample 2"

# Sample 3: Multi-room floor plan
echo "3. Multi-room floor plan..."
curl -L -o "sample-3-multiroom.png" \
  "https://raw.githubusercontent.com/zlzeng/DeepFloorplan/master/resources/example.png" \
  2>/dev/null || echo "  ⚠️  Failed to download sample 3"

echo ""
echo "✅ Download complete!"
echo ""
echo "Test files saved in: $(pwd)"
echo ""
ls -lh *.png *.jpg 2>/dev/null
echo ""
echo "📝 To test:"
echo "   1. Go to: https://roomdetection-6xtkwt79n-natalyscst-gmailcoms-projects.vercel.app"
echo "   2. Upload any file from the test-blueprints/ directory"
echo "   3. Wait for detection results"
echo ""

