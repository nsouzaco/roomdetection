#!/bin/bash

# Location Detection AI - AWS Deployment Script
# This script helps deploy the backend infrastructure to AWS

set -e

echo "🚀 Location Detection AI - AWS Deployment"
echo "========================================="
echo ""

# Check if AWS CLI is configured
echo "📋 Checking AWS credentials..."
if ! aws sts get-caller-identity &>/dev/null; then
    echo "⚠️  AWS credentials not configured."
    echo ""
    echo "Please run: aws configure"
    echo ""
    echo "You'll need:"
    echo "  - AWS Access Key ID"
    echo "  - AWS Secret Access Key"
    echo "  - Default region (e.g., us-east-1)"
    echo "  - Output format (json)"
    echo ""
    read -p "Press Enter after configuring AWS credentials..."
    
    # Check again
    if ! aws sts get-caller-identity &>/dev/null; then
        echo "❌ AWS credentials still not configured. Exiting."
        exit 1
    fi
fi

# Display AWS account info
echo "✅ AWS credentials configured"
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")
echo "   Account: $AWS_ACCOUNT"
echo "   Region: $AWS_REGION"
echo ""

# Navigate to infrastructure directory
cd backend/infrastructure

# Bootstrap CDK (if not already done)
echo "🔧 Bootstrapping AWS CDK..."
if cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION; then
    echo "✅ CDK bootstrap complete"
else
    echo "ℹ️  CDK already bootstrapped or bootstrap failed"
fi
echo ""

# Synthesize CloudFormation template
echo "📦 Synthesizing CDK stack..."
cdk synth
echo ""

# Show what will be deployed
echo "🔍 Reviewing changes..."
cdk diff
echo ""

# Confirm deployment
read -p "🚀 Deploy to AWS? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

# Deploy
echo ""
echo "🚀 Deploying stack to AWS..."
echo "   This may take 5-10 minutes..."
echo ""
cdk deploy --require-approval never

# Get outputs
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Stack Outputs:"
API_URL=$(aws cloudformation describe-stacks \
    --stack-name LocationDetectionStack \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text 2>/dev/null || echo "Not available yet")

BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name LocationDetectionStack \
    --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
    --output text 2>/dev/null || echo "Not available yet")

echo "   API Endpoint: $API_URL"
echo "   S3 Bucket: $BUCKET_NAME"
echo ""

# Update .env file
cd ../..
if [ ! -f .env ]; then
    echo "VITE_API_URL=$API_URL" > .env
    echo "✅ Created .env file with API endpoint"
else
    if grep -q "VITE_API_URL" .env; then
        sed -i.bak "s|VITE_API_URL=.*|VITE_API_URL=$API_URL|" .env
        echo "✅ Updated .env file with API endpoint"
    else
        echo "VITE_API_URL=$API_URL" >> .env
        echo "✅ Added API endpoint to .env file"
    fi
fi

echo ""
echo "🎉 Deployment successful!"
echo ""
echo "📝 Next steps:"
echo "   1. Uncomment real API code in src/services/api.ts (line 88-107)"
echo "   2. Rebuild frontend: npm run build"
echo "   3. Test with real blueprint: npm run dev"
echo "   4. Deploy to Vercel: vercel deploy --prod"
echo ""
echo "📊 Monitor your deployment:"
echo "   - Lambda logs: aws logs tail /aws/lambda/location-detection-opencv --follow"
echo "   - API Gateway: https://console.aws.amazon.com/apigateway"
echo "   - S3 Bucket: https://console.aws.amazon.com/s3"
echo ""

