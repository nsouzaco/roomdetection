#!/bin/bash
echo "🔍 Monitoring YOLO ECS Deployment (Fixed Version)..."
echo ""

for i in {1..30}; do
  # Check task status
  TASK_ARN=$(aws ecs list-tasks --cluster yolo-room-detection-cluster --region us-east-1 --query 'taskArns[0]' --output text 2>/dev/null)
  
  if [ ! -z "$TASK_ARN" ] && [ "$TASK_ARN" != "None" ]; then
    TASK_ID=$(echo $TASK_ARN | rev | cut -d'/' -f1 | rev)
    TASK_STATUS=$(aws ecs describe-tasks --cluster yolo-room-detection-cluster --tasks $TASK_ID --region us-east-1 --query 'tasks[0].lastStatus' --output text 2>/dev/null)
    CONTAINER_STATUS=$(aws ecs describe-tasks --cluster yolo-room-detection-cluster --tasks $TASK_ID --region us-east-1 --query 'tasks[0].containers[0].lastStatus' --output text 2>/dev/null)
    
    echo "[$i/30] Task: $TASK_STATUS | Container: $CONTAINER_STATUS"
    
    if [ "$TASK_STATUS" == "RUNNING" ] && [ "$CONTAINER_STATUS" == "RUNNING" ]; then
      echo ""
      echo "✅ Container is RUNNING! Checking target health..."
      
      # Get target group health
      TG_ARN=$(aws elbv2 describe-target-groups --region us-east-1 --query 'TargetGroups[?contains(TargetGroupName, `YoloRo`)].TargetGroupArn' --output text | head -1)
      
      if [ ! -z "$TG_ARN" ]; then
        TARGET_STATE=$(aws elbv2 describe-target-health --target-group-arn $TG_ARN --region us-east-1 --query 'TargetHealthDescriptions[0].TargetHealth.State' --output text 2>/dev/null)
        echo "Target Health: $TARGET_STATE"
        
        if [ "$TARGET_STATE" == "healthy" ]; then
          echo ""
          echo "🎉 DEPLOYMENT SUCCESSFUL!"
          echo ""
          aws cloudformation describe-stacks --stack-name YoloRoomDetectionStack --region us-east-1 --query 'Stacks[0].Outputs' --output table
          exit 0
        fi
      fi
    fi
  else
    echo "[$i/30] Waiting for task to be created..."
  fi
  
  sleep 10
done

echo ""
echo "⚠️  Monitoring timeout. Check status manually:"
echo "aws ecs describe-services --cluster yolo-room-detection-cluster --services yolo-room-detection-service --region us-east-1"
