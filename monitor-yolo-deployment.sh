#!/bin/bash

echo "🔍 Monitoring YOLO ECS Deployment..."
echo ""

while true; do
  clear
  echo "=== YOLO Room Detection Stack Status ==="
  echo ""
  
  # Get stack status
  STATUS=$(aws cloudformation describe-stacks --stack-name YoloRoomDetectionStack --region us-east-1 --query 'Stacks[0].StackStatus' --output text 2>/dev/null)
  
  if [ -z "$STATUS" ]; then
    echo "❌ Stack not found"
    break
  fi
  
  echo "Stack Status: $STATUS"
  echo ""
  
  # If complete, show outputs
  if [ "$STATUS" == "CREATE_COMPLETE" ] || [ "$STATUS" == "UPDATE_COMPLETE" ]; then
    echo "✅ Deployment Complete!"
    echo ""
    echo "=== Stack Outputs ==="
    aws cloudformation describe-stacks --stack-name YoloRoomDetectionStack --region us-east-1 --query 'Stacks[0].Outputs' --output table
    break
  fi
  
  # If failed, show reason
  if [[ "$STATUS" == *"FAILED"* ]] || [[ "$STATUS" == *"ROLLBACK"* ]]; then
    echo "❌ Deployment Failed!"
    echo ""
    echo "=== Recent Errors ==="
    aws cloudformation describe-stack-events --stack-name YoloRoomDetectionStack --region us-east-1 --max-items 5 --query 'StackEvents[?ResourceStatus==`CREATE_FAILED` || ResourceStatus==`UPDATE_FAILED`].[Timestamp,ResourceType,ResourceStatusReason]' --output table
    break
  fi
  
  # Show recent events
  echo "=== Recent Events (last 5) ==="
  aws cloudformation describe-stack-events --stack-name YoloRoomDetectionStack --region us-east-1 --max-items 5 --query 'StackEvents[*].[Timestamp,ResourceType,ResourceStatus]' --output table
  
  echo ""
  echo "Refreshing in 10 seconds... (Ctrl+C to stop)"
  sleep 10
done
