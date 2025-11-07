# Quick Start Guide

Get the Location Detection AI app running locally in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- npm installed
- Modern web browser

## Local Development (Frontend Only with Mock Data)

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Dev Server

```bash
npm run dev
```

### 3. Open Browser

Navigate to `http://localhost:5173`

### 4. Test the App

1. **Upload a Blueprint**: Drag and drop any blueprint image (PNG/JPG/TIFF)
2. **View Detection**: Mock rooms will appear after 2 seconds
3. **Interact**: Click rooms to select, drag to adjust position
4. **Export**: Download detection results as JSON

## What's Included

The current setup includes:

✅ **Fully functional frontend** with mock backend  
✅ **Beautiful, modern UI** with Tailwind CSS  
✅ **Interactive canvas** with Konva.js  
✅ **Drag-and-drop upload** with validation  
✅ **Mock room detection** (returns 5 sample rooms)  
✅ **Export functionality** (JSON download)  

## Testing with Mock Data

The app currently uses mock detection in `src/services/api.ts`:

```typescript
// Mock response returns 5 sample rooms
{
  "rooms": [
    {
      "id": "room_001",
      "bounding_box": [100, 100, 350, 300],
      "confidence": 0.92,
      "name_hint": "Living Room"
    },
    // ... 4 more rooms
  ]
}
```

## Deploying to AWS (Real Detection)

To use real OpenCV-based detection, follow `DEPLOYMENT.md`:

```bash
# 1. Install AWS CDK
npm install -g aws-cdk

# 2. Configure AWS credentials
aws configure

# 3. Deploy backend
cd backend/infrastructure
npm install
cdk bootstrap  # First time only
cdk deploy

# 4. Update frontend .env with API URL
VITE_API_URL=https://your-api-url.execute-api.us-east-1.amazonaws.com/prod

# 5. Uncomment real API code in src/services/api.ts
```

## Project Commands

```bash
# Frontend
npm run dev        # Start dev server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run linter

# Backend (CDK)
cd backend/infrastructure
npm run cdk synth  # Generate CloudFormation template
npm run deploy     # Deploy to AWS
npm run destroy    # Remove all AWS resources
```

## Troubleshooting

### Port Already in Use

If port 5173 is busy:
```bash
# Find and kill process
lsof -ti:5173 | xargs kill -9

# Or use different port
npm run dev -- --port 3000
```

### Dependencies Not Installing

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

```bash
# Check TypeScript version
npm list typescript

# Rebuild
npm run build
```

## File Structure Quick Reference

```
src/
├── components/
│   ├── upload/UploadZone.tsx          # Drag-and-drop upload
│   ├── canvas/BlueprintCanvas.tsx      # Konva canvas
│   └── common/                         # Buttons, Cards, etc.
├── services/api.ts                     # API client (mock data)
├── types/blueprint.ts                  # TypeScript types
├── utils/coordinates.ts                # Coordinate conversion
└── App.tsx                            # Main application
```

## Next Steps

1. ✅ **Test locally** with mock data (you are here!)
2. 📚 **Read** `README.md` for architecture details
3. 🚀 **Deploy** to AWS following `DEPLOYMENT.md`
4. 🧪 **Test** with real blueprint images
5. 📊 **Measure** accuracy and iterate
6. 🎯 **Phase 2**: Train YOLO v8 model (see `PHASE2_PLAN.md`)

## Resources

- **README.md** - Full project documentation
- **DEPLOYMENT.md** - AWS deployment guide
- **PHASE2_PLAN.md** - YOLO v8 integration plan
- **memory-bank/** - Project context and progress

## Need Help?

- Check CloudWatch logs (after AWS deployment)
- Review browser console for frontend errors
- Open an issue on GitHub
- Check the troubleshooting section in DEPLOYMENT.md

---

**Happy coding! 🚀**

