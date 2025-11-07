#!/usr/bin/env node
/**
 * AWS CDK entry point for Location Detection AI infrastructure
 */
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LocationDetectionStack } from '../lib/location-detection-stack';

const app = new cdk.App();

new LocationDetectionStack(app, 'LocationDetectionStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'Location Detection AI - Phase 1 MVP (OpenCV-based room detection)',
});

app.synth();

