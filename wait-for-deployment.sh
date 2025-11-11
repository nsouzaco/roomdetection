#!/bin/bash
echo "🚀 Monitoring YOLO ECS Deployment (Attempt #3 with ultralytics 8.3.226)"
echo "⏳ Waiting for Docker build and ECR push to complete..."
echo ""

START_TIME=$(date +%s)

while true; do
  ELAPSED=$(($(date +%s) - START_TIME))
  MINUTES=$((ELAPSED / 60))
  SECONDS=$((ELAPSED % 60))
  
  # Check if stack exists
  STATUS=$(aws cloudformation describe-stacks --stack-name YoloRoomDetectionStack --region us-east-1 --query 'Stacks[0].StackStatus' --output text 2>/dev/null)
  
  if [ ! -z "$STATUS" ] && [ "$STATUS" != "None" ]; then
    echo ""
    echo "✅ Stack creation started! (after ${MINUTES}m ${SECONDS}s)"
    echo "Stack Status: $STATUS"
    echo ""
    echo "📊 Deployment progress:"
    aws cloudformation describe-stack-events --stack-name YoloRoomDetectionStack --region us-east-1 --max-items 10 --query 'StackEvents[*].[Timestamp,ResourceType,ResourceStatus]' --output table
    echo ""
    echo "🔄 Monitoring will continue until deployment completes..."
    break
  fi
  
  # Check if CDK process is still running
  if ! ps aux | grep -E "cdk deploy" | grep -v grep > /dev/null; then
    echo ""
    echo "⚠️  CDK process ended but no stack found. Check for errors."
    exit 1
  fi
  
  printf "\r[%02d:%02d] Still pushing Docker image to ECR..." $MINUTES $SECONDS
  sleep 5
done

# Continue monitoring until complete or failed
while true; do
  sleep 15
  STATUS=$(aws cloudformation describe-stacks --stack-name YoloRoomDetectionStack --region us-east-1 --query 'Stacks[0].StackStatus' --output text 2>/dev/null)
  
  if [ "$STATUS" == "CREATE_COMPLETE" ]; then
    echo ""
    echo "🎉 DEPLOYMENT SUCCESSFUL!"
    echo ""
    aws cloudformation describe-stacks --stack-name YoloRoomDetectionStack --region us-east-1 --query 'Stacks[0].Outputs' --output table
    exit 0
  elif [[ "$STATUS" == *"FAILED"* ]] || [[ "$STATUS" == *"ROLLBACK"* ]]; then
    echo ""
    echo "❌ Deployment Failed: $STATUS"
    aws cloudformation describe-stack-events --stack-name YoloRoomDetectionStack --region us-east-1 --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].[ResourceType,ResourceStatusReason]' --output table
    exit 1
  fi
  
  echo "Status: $STATUS - waiting..."
done
