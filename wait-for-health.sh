#!/bin/bash
echo "⏳ Waiting for YOLO service to become healthy..."
echo ""

TG_ARN="arn:aws:elasticloadbalancing:us-east-1:971422717446:targetgroup/YoloRo-YoloT-ES4DQWMGFRXW/230ffaf02ee7d332"

for i in {1..20}; do
  HEALTH=$(aws elbv2 describe-target-health --target-group-arn $TG_ARN --region us-east-1 --query 'TargetHealthDescriptions[0].TargetHealth.{State:State,Reason:Reason}' --output json)
  
  STATE=$(echo $HEALTH | jq -r '.State')
  REASON=$(echo $HEALTH | jq -r '.Reason')
  
  echo "[$i/20] Target State: $STATE - $REASON"
  
  if [ "$STATE" == "healthy" ]; then
    echo ""
    echo "✅ Target is HEALTHY! Checking CloudFormation stack..."
    sleep 5
    
    STACK_STATUS=$(aws cloudformation describe-stacks --stack-name YoloRoomDetectionStack --region us-east-1 --query 'Stacks[0].StackStatus' --output text)
    echo "Stack Status: $STACK_STATUS"
    
    if [ "$STACK_STATUS" == "CREATE_COMPLETE" ]; then
      echo ""
      echo "🎉 Deployment Complete!"
      echo ""
      echo "=== Load Balancer URL ==="
      aws cloudformation describe-stacks --stack-name YoloRoomDetectionStack --region us-east-1 --query 'Stacks[0].Outputs' --output table
    fi
    break
  fi
  
  if [ "$STATE" == "unhealthy" ]; then
    echo ""
    echo "❌ Target is UNHEALTHY. Checking container logs..."
    aws ecs describe-tasks --cluster yolo-room-detection-cluster --tasks $(aws ecs list-tasks --cluster yolo-room-detection-cluster --region us-east-1 --query 'taskArns[0]' --output text) --region us-east-1 --query 'tasks[0].containers[0]'
    break
  fi
  
  sleep 15
done
