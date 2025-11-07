# AWS Deployment Setup

Quick guide to deploy the Location Detection AI backend to AWS.

## Prerequisites

✅ AWS CLI installed (done)  
✅ AWS CDK installed (done)  
✅ Infrastructure dependencies installed (done)  

## Step 1: Get AWS Credentials

### Option A: Use Existing AWS Account

1. Log in to [AWS Console](https://console.aws.amazon.com)
2. Go to [IAM → Users](https://console.aws.amazon.com/iam/home#/users)
3. Click your username → **Security credentials**
4. Click **Create access key** → Choose "CLI"
5. Copy both:
   - Access Key ID
   - Secret Access Key (only shown once!)

### Option B: Create New IAM User

1. Go to [IAM Console](https://console.aws.amazon.com/iam)
2. Click **Users** → **Add users**
3. Username: `location-detection-deployer`
4. Select **Access key - Programmatic access**
5. Attach policies:
   - `AdministratorAccess` (for deployment)
   - Or create custom policy (see below)
6. Copy credentials

### Required AWS Permissions

If not using AdministratorAccess, the user needs:
- Lambda (create, update, invoke)
- S3 (create bucket, put/get objects)
- API Gateway (create, configure)
- CloudWatch (create alarms, log groups)
- IAM (create roles for Lambda)
- CloudFormation (create/update stacks)

## Step 2: Configure AWS CLI

```bash
aws configure
```

Enter when prompted:
- **AWS Access Key ID**: [your-key-id]
- **AWS Secret Access Key**: [your-secret-key]
- **Default region**: `us-east-1` (or your preferred region)
- **Default output format**: `json`

Verify configuration:
```bash
aws sts get-caller-identity
```

Should return:
```json
{
    "UserId": "...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/..."
}
```

## Step 3: Deploy Infrastructure

Run the deployment script:

```bash
./deploy.sh
```

The script will:
1. ✅ Verify AWS credentials
2. ✅ Bootstrap CDK in your account (one-time setup)
3. ✅ Show you what will be deployed
4. ✅ Ask for confirmation
5. ✅ Deploy all resources (5-10 minutes)
6. ✅ Update your `.env` file automatically

### What Gets Deployed

| Resource | Purpose | Cost (est.) |
|----------|---------|-------------|
| **Lambda Function** | OpenCV room detection | ~$8/month (1000 requests) |
| **S3 Bucket** | Blueprint storage | ~$0.50/month |
| **API Gateway** | REST API endpoints | ~$0.01/month |
| **CloudWatch** | Logs and monitoring | ~$1/month |
| **Total** | | **~$9.51/month** |

Per-request cost: **~$0.01** (well under $0.05 target)

## Step 4: Test Deployment

After deployment completes, you'll see:

```
✅ Deployment complete!

📋 Stack Outputs:
   API Endpoint: https://abc123.execute-api.us-east-1.amazonaws.com/prod/
   S3 Bucket: location-detection-blueprints-123456789012
```

### Test the API

```bash
# Check Lambda function
aws lambda invoke \
  --function-name location-detection-opencv \
  --payload '{}' \
  response.json

# View logs
aws logs tail /aws/lambda/location-detection-opencv --follow
```

## Step 5: Connect Frontend

Your `.env` file has been automatically updated with the API endpoint.

Now enable real API calls:

1. **Edit** `src/services/api.ts`
2. **Uncomment** lines 88-107 (real API implementation)
3. **Comment out** lines 77-85 (mock response)
4. **Rebuild**: `npm run build`
5. **Test**: `npm run dev`

## Monitoring & Management

### View CloudWatch Logs

```bash
# Lambda logs
aws logs tail /aws/lambda/location-detection-opencv --follow

# API Gateway logs  
aws logs tail /aws/apigateway/LocationDetectionApi --follow
```

### View Metrics

```bash
# Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=location-detection-opencv \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### AWS Console Links

- **Lambda**: https://console.aws.amazon.com/lambda
- **API Gateway**: https://console.aws.amazon.com/apigateway
- **S3**: https://console.aws.amazon.com/s3
- **CloudWatch**: https://console.aws.amazon.com/cloudwatch
- **CloudFormation**: https://console.aws.amazon.com/cloudformation

## Troubleshooting

### "Unable to locate credentials"

```bash
# Check configuration
aws configure list

# Reconfigure
aws configure
```

### "Stack already exists"

```bash
# Update existing stack
cd backend/infrastructure
cdk deploy
```

### "Bootstrap required"

```bash
# Get account and region
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)

# Bootstrap
cdk bootstrap aws://$ACCOUNT/$REGION
```

### Lambda timeout errors

- Increase timeout in `backend/infrastructure/lib/location-detection-stack.ts`
- Default: 30 seconds
- Max: 900 seconds (15 minutes)

### Out of memory

- Increase memory in CDK stack
- Current: 3008 MB (max)
- Consider using SageMaker for Phase 2

## Updating the Stack

After making changes:

```bash
cd backend/infrastructure

# See what changed
cdk diff

# Deploy updates
cdk deploy
```

## Cost Optimization

1. **Enable S3 lifecycle** (already configured)
   - Auto-delete files after 24 hours
   
2. **Reduce Lambda memory** if not needed
   - Current: 3008 MB
   - Test with: 2048 MB or 1536 MB

3. **Use reserved concurrency** for predictable workloads

4. **Enable Lambda SnapStart** (when available for Python)

## Cleanup / Destroy

To remove all resources:

```bash
cd backend/infrastructure
cdk destroy
```

**Warning**: This will delete:
- Lambda function
- S3 bucket (and all blueprints)
- API Gateway
- CloudWatch logs

## Next Steps

1. ✅ Deploy backend (you are here!)
2. 📱 Connect frontend to API
3. 🧪 Test with real blueprints
4. 🚀 Deploy frontend to Vercel
5. 📊 Monitor performance metrics
6. 🎯 Plan Phase 2 (YOLO v8)

## Support

- **Documentation**: See `README.md` and `DEPLOYMENT.md`
- **Logs**: Check CloudWatch logs
- **Errors**: Review Lambda function errors in AWS Console

---

**Ready to deploy?** Run `./deploy.sh` 🚀

