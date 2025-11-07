#!/bin/bash

# Monitor Location Detection AI system

echo "📊 Location Detection AI - System Monitor"
echo "=========================================="
echo ""

# Frontend
echo "🌐 Frontend:"
echo "   URL: https://roomdetection-6xtkwt79n-natalyscst-gmailcoms-projects.vercel.app"
echo "   Status: $(curl -s -o /dev/null -w '%{http_code}' https://roomdetection-6xtkwt79n-natalyscst-gmailcoms-projects.vercel.app)"
echo ""

# Backend API
echo "☁️  Backend API:"
echo "   URL: https://sksadeo2r2.execute-api.us-east-1.amazonaws.com/prod/"
echo "   Status: $(curl -s -o /dev/null -w '%{http_code}' https://sksadeo2r2.execute-api.us-east-1.amazonaws.com/prod/detect)"
echo ""

# Lambda Function
echo "⚡ Lambda Function:"
aws lambda get-function --function-name location-detection-opencv \
  --query 'Configuration.[FunctionName,State,LastUpdateStatus,MemorySize,Timeout]' \
  --output table

echo ""
echo "📊 Recent Invocations (Last 5 minutes):"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=location-detection-opencv \
  --start-time $(date -u -v-5M +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --query 'Datapoints[0].Sum' \
  --output text || echo "0"

echo ""
echo "⚠️  Errors (Last 5 minutes):"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=location-detection-opencv \
  --start-time $(date -u -v-5M +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --query 'Datapoints[0].Sum' \
  --output text || echo "0"

echo ""
echo "⏱️  Average Duration (Last 5 minutes):"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=location-detection-opencv \
  --start-time $(date -u -v-5M +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average \
  --query 'Datapoints[0].Average' \
  --output text | awk '{printf "%.0f ms\n", $1}' || echo "No data"

echo ""
echo "📝 Recent Logs:"
echo "   Run: aws logs tail /aws/lambda/location-detection-opencv --follow"
echo ""
echo "💾 S3 Bucket Usage:"
aws s3 ls s3://location-detection-blueprints-971422717446 --summarize --human-readable --recursive 2>/dev/null | tail -2

echo ""
echo "---"
echo "Refresh: ./monitor.sh"
echo "Logs: aws logs tail /aws/lambda/location-detection-opencv --follow"
echo "---"

