# Testing Guide - Location Detection AI

## 🧪 How to Test Your System

### Quick Test (2 minutes)

1. **Visit your live site:**
   https://roomdetection-6xtkwt79n-natalyscst-gmailcoms-projects.vercel.app

2. **Get test blueprints** from any of these sources:

---

## 📥 Where to Get Test Blueprints

### Option 1: Google Images (Easiest)

Search for: **"architectural floor plan simple"** or **"house blueprint"**

Good search terms:
- "residential floor plan"
- "apartment blueprint"
- "office floor plan"
- "house layout diagram"

**Save as PNG or JPG** (right-click → Save Image As)

### Option 2: Free Blueprint Websites

1. **FreePik** (free with attribution)
   - https://www.freepik.com/search?format=search&query=floor+plan
   - Download PNG versions

2. **Unsplash** (completely free)
   - https://unsplash.com/s/photos/floor-plan
   - High-quality architectural images

3. **ArchDaily** (architecture website)
   - https://www.archdaily.com
   - Browse projects, save floor plan images

4. **Pinterest**
   - Search: "simple floor plan"
   - Right-click and save images

### Option 3: Public Datasets

1. **CubiCasa5K Dataset**
   - https://github.com/CubiCasa/CubiCasa5k
   - 5,000+ floor plans with annotations

2. **RPLAN Dataset**
   - http://staff.ustc.edu.cn/~fuxm/projects/DeepLayout/index.html
   - Large-scale floor plan dataset

3. **FloorNet Dataset**
   - https://github.com/art-programmer/FloorNet
   - 3D reconstructed floor plans

### Option 4: Create Your Own

Use any floor plan drawing tool:
- **Floorplanner.com** (free account)
- **RoomSketcher** (free trial)
- **SketchUp Free** (web-based)
- **Planner 5D** (free online)

Export as PNG or JPG.

---

## 🎯 What Makes a Good Test Blueprint?

### ✅ GOOD Blueprints
- Clear, dark walls on light background
- Simple rectangular rooms
- High contrast (black/white or dark/light)
- Resolution: 800x800px or higher
- File size: Under 10MB
- Format: PNG, JPG, or TIFF

### ❌ AVOID
- 3D renderings or photos
- Low resolution (<400px)
- Complex architectural drawings with too much detail
- Colored blueprints with textures
- Scanned documents with text overlay

---

## 📊 Testing Procedure

### 1. Basic Functionality Test

Upload a simple floor plan and check:
- ✅ File uploads successfully
- ✅ Processing completes in <30 seconds
- ✅ Rooms are detected
- ✅ Boundaries are drawn on canvas
- ✅ Confidence scores are shown

### 2. Quality Test

Test with 5-10 different blueprints:
- Count total rooms in blueprint (manual)
- Count detected rooms (automatic)
- Calculate accuracy: (detected / actual) × 100%
- Note false positives (incorrect rooms)
- Note false negatives (missed rooms)

### 3. Performance Test

Monitor backend logs:
```bash
aws logs tail /aws/lambda/location-detection-opencv --follow
```

Check for:
- Processing time per blueprint
- Error rates
- Memory usage
- Cold start delays

### 4. Edge Cases

Test with:
- Rotated blueprints
- Low-quality scans
- Complex L-shaped rooms
- Open floor plans
- Very small rooms (<5m²)
- Very large blueprints (>5MB)

---

## 🐛 Common Issues & Fixes

### Issue: No rooms detected

**Possible causes:**
- Image has low contrast
- Walls are too thin or faint
- Blueprint is too complex

**Fix:**
- Try a simpler blueprint
- Adjust confidence threshold in API
- Preprocess image (increase contrast)

### Issue: Too many false positives

**Possible causes:**
- Image has furniture or text
- Grid lines detected as walls

**Fix:**
- Use cleaner blueprints
- Adjust post-processing filters
- Tune OpenCV parameters

### Issue: Processing takes >30 seconds

**Possible causes:**
- Large image file
- Lambda cold start
- Complex detection

**Fix:**
- Resize images before upload
- Keep Lambda warm with CloudWatch Events
- Increase Lambda memory

---

## 📈 Measuring Accuracy

### Manual Accuracy Test

1. **Select 10-20 test blueprints**
2. **For each blueprint:**
   - Count actual rooms: `A`
   - Upload to system
   - Count detected rooms: `D`
   - Count correct detections: `C`
   
3. **Calculate metrics:**
   - **Precision:** C / D (accuracy of detections)
   - **Recall:** C / A (coverage of actual rooms)
   - **F1 Score:** 2 × (Precision × Recall) / (Precision + Recall)
   - **Target:** F1 Score ≥ 0.75 (75%)

### Example

```
Blueprint: simple-house.png
Actual rooms: 5
Detected rooms: 6
Correct detections: 4

Precision: 4/6 = 0.67 (67%)
Recall: 4/5 = 0.80 (80%)
F1 Score: 2 × (0.67 × 0.80) / (0.67 + 0.80) = 0.73 (73%)
```

---

## 🔍 Debugging

### View Lambda Logs

```bash
# Real-time logs
aws logs tail /aws/lambda/location-detection-opencv --follow

# Last 10 minutes
aws logs tail /aws/lambda/location-detection-opencv --since 10m

# Filter errors only
aws logs filter-pattern /aws/lambda/location-detection-opencv --filter-pattern "ERROR"
```

### Test Lambda Directly

```bash
# Invoke Lambda with test payload
aws lambda invoke \
  --function-name location-detection-opencv \
  --payload '{"body":"test"}' \
  --log-type Tail \
  response.json

# View response
cat response.json
```

### Check API Gateway

```bash
# Test /detect endpoint
curl -X POST https://sksadeo2r2.execute-api.us-east-1.amazonaws.com/prod/detect \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test-blueprints/sample.png"
```

---

## 💡 Quick Tips

1. **Start simple:** Test with basic rectangular room layouts first
2. **Monitor logs:** Watch Lambda logs while testing
3. **Compare results:** Try same blueprint with different parameters
4. **Document issues:** Note which types of blueprints fail
5. **Iterate:** Use findings to improve Phase 2 (YOLO) training

---

## 🎓 Example Test Session

```bash
# 1. Start monitoring
aws logs tail /aws/lambda/location-detection-opencv --follow &

# 2. Open browser and upload test blueprint
open https://roomdetection-6xtkwt79n-natalyscst-gmailcoms-projects.vercel.app

# 3. Watch logs for processing details
# (logs will show in terminal)

# 4. Check CloudWatch metrics
./monitor.sh

# 5. Record results in spreadsheet
# Blueprint | Actual Rooms | Detected | Correct | Precision | Recall
```

---

## 📞 Next Steps

After testing 10-20 blueprints:
1. Calculate average F1 score
2. Identify failure patterns
3. Document edge cases
4. Plan improvements for Phase 2
5. Collect more training data if needed

---

**Ready to test?** Upload your first blueprint now! 🚀

**Live Site:** https://roomdetection-6xtkwt79n-natalyscst-gmailcoms-projects.vercel.app

