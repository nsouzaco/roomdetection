# Deployment Guide

Complete guide for deploying the Location Detection AI application to AWS.

## Prerequisites

### Required Tools

1. **AWS CLI**
   ```bash
   # Install AWS CLI
   curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
   sudo installer -pkg AWSCLIV2.pkg -target /
   
   # Configure credentials
   aws configure
   ```

2. **Node.js and npm**
   ```bash
   # Verify installation
   node --version  # Should be 18+
   npm --version
   ```

3. **Docker**
   ```bash
   # Verify installation
   docker --version
   
   # Ensure Docker is running
   docker ps
   ```

4. **AWS CDK**
   ```bash
   npm install -g aws-cdk
   cdk --version
   ```

## Step-by-Step Deployment

### 1. Configure AWS Credentials

```bash
# Set up AWS credentials (if not already configured)
aws configure

# Verify credentials
aws sts get-caller-identity
```

### 2. Bootstrap AWS CDK (First Time Only)

```bash
cd backend/infrastructure

# Bootstrap CDK in your AWS account
cdk bootstrap aws://ACCOUNT-ID/REGION

# Example:
# cdk bootstrap aws://123456789012/us-east-1
```

### 3. Install Dependencies

```bash
# Frontend dependencies
npm install

# Backend CDK dependencies
cd backend/infrastructure
npm install
cd ../..
```

### 4. Build Lambda Container

The Lambda container will be built automatically during CDK deployment, but you can test locally:

```bash
cd backend/lambda

# Build Docker image locally (optional)
docker build -t location-detection-lambda .

# Test locally (optional)
docker run -p 9000:8080 location-detection-lambda
```

### 5. Deploy Backend Infrastructure

```bash
cd backend/infrastructure

# Review what will be deployed
cdk diff

# Deploy stack
cdk deploy

# Approve IAM changes when prompted
# Note the API Gateway URL from the output
```

**Expected Output:**
```
✅  LocationDetectionStack

Outputs:
LocationDetectionStack.ApiEndpoint = https://abc123.execute-api.us-east-1.amazonaws.com/prod/
LocationDetectionStack.BucketName = location-detection-blueprints-123456789012
LocationDetectionStack.LambdaFunctionArn = arn:aws:lambda:us-east-1:123456789012:function:location-detection-opencv
```

### 6. Configure Frontend Environment

Create `.env` file in project root:

```env
VITE_API_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod
```

### 7. Build and Deploy Frontend

#### Option A: Deploy to S3 + CloudFront (Recommended)

```bash
# Build frontend
npm run build

# Create S3 bucket for hosting
aws s3 mb s3://location-detection-frontend-YOUR-ACCOUNT-ID

# Enable static website hosting
aws s3 website s3://location-detection-frontend-YOUR-ACCOUNT-ID \
  --index-document index.html \
  --error-document index.html

# Upload build files
aws s3 sync dist/ s3://location-detection-frontend-YOUR-ACCOUNT-ID

# Set bucket policy for public access
aws s3api put-bucket-policy \
  --bucket location-detection-frontend-YOUR-ACCOUNT-ID \
  --policy file://s3-bucket-policy.json
```

**s3-bucket-policy.json:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::location-detection-frontend-YOUR-ACCOUNT-ID/*"
    }
  ]
}
```

#### Option B: Deploy to Vercel (Alternative)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel deploy --prod
```

#### Option C: Deploy to Netlify (Alternative)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

## Cost Estimation

### Monthly Costs (Estimated)

Based on 1,000 blueprint detections per month:

| Service | Usage | Cost |
|---------|-------|------|
| **Lambda** | 1,000 invocations × 30s × 3008MB | ~$8.00 |
| **API Gateway** | 1,000 requests | ~$0.01 |
| **S3** | 10GB storage + data transfer | ~$0.50 |
| **CloudWatch** | Logs and metrics | ~$1.00 |
| **Total** | | **~$9.51/month** |

**Per Blueprint Cost:** ~$0.01 (well under $0.05 target)

### Cost Optimization Tips

1. **Reduce Lambda Memory**: Start with 2048MB and monitor performance
2. **Enable S3 Lifecycle**: Automatic deletion after 24 hours (already configured)
3. **Use Reserved Concurrency**: For predictable workloads
4. **Enable Lambda SnapStart**: Reduce cold start times

## Monitoring & Troubleshooting

### CloudWatch Dashboard

```bash
# View Lambda logs
aws logs tail /aws/lambda/location-detection-opencv --follow

# View API Gateway logs
aws logs tail /aws/apigateway/location-detection --follow
```

### Common Issues

#### 1. Lambda Timeout

**Symptom:** 502 Bad Gateway or timeout errors

**Solution:**
- Increase Lambda timeout in CDK stack (currently 30s)
- Optimize image preprocessing
- Use smaller image sizes

#### 2. CORS Errors

**Symptom:** Browser console shows CORS policy errors

**Solution:**
- Verify API Gateway CORS configuration
- Check Lambda response headers include CORS headers
- Update allowed origins in CDK stack

#### 3. Out of Memory

**Symptom:** Lambda crashes with memory errors

**Solution:**
- Increase Lambda memory allocation (currently 3008MB max)
- Optimize OpenCV operations
- Consider using SageMaker for Phase 2

#### 4. Cold Start Delays

**Symptom:** First request takes 3-5 seconds

**Solution:**
- Use Lambda provisioned concurrency
- Keep Lambda warm with CloudWatch Events
- Consider EFS for shared dependencies

### Performance Monitoring

```bash
# Get Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=location-detection-opencv \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average,Maximum

# Get API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name 4XXError \
  --dimensions Name=ApiName,Value=LocationDetectionApi \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

## Rollback

If deployment fails or you need to rollback:

```bash
# Destroy the stack
cd backend/infrastructure
cdk destroy

# Delete frontend S3 bucket
aws s3 rb s3://location-detection-frontend-YOUR-ACCOUNT-ID --force
```

## Security Considerations

### Production Checklist

- [ ] Enable API Gateway API keys
- [ ] Restrict CORS to specific domains
- [ ] Enable AWS WAF for API Gateway
- [ ] Use VPC for Lambda (if accessing private resources)
- [ ] Enable S3 bucket versioning
- [ ] Set up CloudTrail for audit logging
- [ ] Use Secrets Manager for sensitive data
- [ ] Implement rate limiting
- [ ] Enable AWS Shield for DDoS protection
- [ ] Use CloudFront for frontend CDN

### IAM Best Practices

- Use least privilege principle for Lambda execution role
- Separate roles for different functions
- Enable MFA for AWS console access
- Rotate access keys regularly
- Use IAM roles for service-to-service communication

## CI/CD Pipeline (Optional)

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Install dependencies
        run: |
          npm install
          cd backend/infrastructure && npm install
      
      - name: Deploy CDK stack
        run: |
          cd backend/infrastructure
          npx cdk deploy --require-approval never
      
      - name: Build frontend
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
      
      - name: Deploy to S3
        run: |
          aws s3 sync dist/ s3://location-detection-frontend-${{ secrets.AWS_ACCOUNT_ID }}
```

## Support

For deployment issues:

1. Check CloudWatch logs
2. Review AWS CDK documentation
3. Consult the troubleshooting section above
4. Open an issue on GitHub

---

**Last Updated:** November 2025

