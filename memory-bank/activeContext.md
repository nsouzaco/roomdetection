# Active Context

## Current Work Focus
Phase 1 MVP is code-complete! All frontend and backend components are built. Next step is AWS deployment and real-world testing.

## Recent Changes
- ✅ Complete frontend UI with all components
- ✅ Full AWS infrastructure with CDK
- ✅ OpenCV-based room detection Lambda function
- ✅ API Gateway with CORS and pre-signed URLs
- ✅ Comprehensive documentation (README, DEPLOYMENT, PHASE2_PLAN)
- ✅ Clean, minimal design system (Figma/Linear inspired)
- ✅ Mock data integration for local testing

## Next Steps (Immediate)

### 1. Frontend Foundation Setup
- Install required dependencies (Konva.js, Axios, React Query, Tailwind CSS)
- Set up project structure (components, services, types, hooks)
- Configure Tailwind for modern UI styling

### 2. Core UI Components
- Create UploadZone with drag-and-drop
- Build BlueprintCanvas with Konva.js
- Design ProcessingStatus component
- Build ControlPanel for user actions

### 3. Backend MVP (Phase 1)
- Set up AWS Lambda with Python runtime
- Implement OpenCV-based room detection
- Configure S3 bucket for blueprint storage
- Set up API Gateway endpoints

### 4. Integration
- Connect frontend to backend API
- Implement file upload flow
- Display detection results on canvas
- Add error handling and loading states

## Active Decisions and Considerations

### Design System
**Decision Needed**: Choose specific design direction
- **Options**: 
  - Material-inspired (clean, familiar)
  - Tailwind-based custom design (flexible, modern)
  - Design system library (Shadcn UI, Radix UI)
- **Preference**: Modern, intuitive, professional
- **User request**: Modern and intuitive design guidelines

### File Upload Strategy
**Decision**: Direct S3 upload vs Lambda proxy
- **Recommendation**: Direct S3 upload with pre-signed URLs
- **Rationale**: Avoids Lambda 6MB payload limit, faster uploads

### Canvas Library
**Decision Needed**: Konva.js vs Fabric.js
- **Both options** are viable per PRD
- **Consideration**: Konva has better React integration (react-konva)

### State Management
**Decision**: React Query vs Redux vs Context
- **Recommendation**: React Query for API state, Context for UI state
- **Rationale**: Simpler, less boilerplate, better for async data

## Current Challenges
- Need to define exact UI/UX design system
- Need to clarify AWS deployment approach (IaC tool preference?)
- Need to determine if backend should be in same repo or separate

## Questions for User
1. **Design preference**: Any specific design system or inspiration (e.g., modern SaaS apps like Figma, Notion)?
2. **Deployment**: Should we use AWS CDK, Terraform, or SAM for infrastructure-as-code?
3. **Repository structure**: Single monorepo or separate frontend/backend repos?
4. **Authentication**: Does the app need user authentication, or is it open access?
5. **Backend language**: PRD mentions Python for Lambda - confirm this is the preferred language?
6. **Phase scope**: Should we focus on completing Phase 1 (OpenCV MVP) first, or start with frontend and stub backend?

## Development Environment
- **OS**: macOS (darwin 25.0.0)
- **Shell**: zsh
- **Node/npm**: Version info available via package.json
- **Current directory**: `/Users/nat/roomdetection`

## Notes
- PRD is extremely comprehensive and well-structured
- Clear phased approach (Phase 1: OpenCV, Phase 2: YOLO)
- Strong emphasis on modern, intuitive UI
- Cost and performance constraints are well-defined
- No authentication/authorization mentioned in PRD (assume internal tool or to be added later)

