#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CDK App Entry Point for YOLO ECS Deployment
 * Deploys YOLO service to ECS/Fargate
 */
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const yolo_ecs_stack_1 = require("../lib/yolo-ecs-stack");
const app = new cdk.App();
new yolo_ecs_stack_1.YoloEcsStack(app, 'YoloRoomDetectionStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    },
    description: 'YOLO Room Detection Service on ECS/Fargate',
    tags: {
        Project: 'LocationDetection',
        Service: 'YOLO',
        Environment: 'production',
    },
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwbG95LXlvbG8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkZXBsb3kteW9sby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBOzs7R0FHRztBQUNILHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsMERBQXFEO0FBRXJELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLElBQUksNkJBQVksQ0FBQyxHQUFHLEVBQUUsd0JBQXdCLEVBQUU7SUFDOUMsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVc7S0FDdEQ7SUFDRCxXQUFXLEVBQUUsNENBQTRDO0lBQ3pELElBQUksRUFBRTtRQUNKLE9BQU8sRUFBRSxtQkFBbUI7UUFDNUIsT0FBTyxFQUFFLE1BQU07UUFDZixXQUFXLEVBQUUsWUFBWTtLQUMxQjtDQUNGLENBQUMsQ0FBQztBQUVILEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbi8qKlxuICogQ0RLIEFwcCBFbnRyeSBQb2ludCBmb3IgWU9MTyBFQ1MgRGVwbG95bWVudFxuICogRGVwbG95cyBZT0xPIHNlcnZpY2UgdG8gRUNTL0ZhcmdhdGVcbiAqL1xuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IFlvbG9FY3NTdGFjayB9IGZyb20gJy4uL2xpYi95b2xvLWVjcy1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbm5ldyBZb2xvRWNzU3RhY2soYXBwLCAnWW9sb1Jvb21EZXRlY3Rpb25TdGFjaycsIHtcbiAgZW52OiB7XG4gICAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAndXMtZWFzdC0xJyxcbiAgfSxcbiAgZGVzY3JpcHRpb246ICdZT0xPIFJvb20gRGV0ZWN0aW9uIFNlcnZpY2Ugb24gRUNTL0ZhcmdhdGUnLFxuICB0YWdzOiB7XG4gICAgUHJvamVjdDogJ0xvY2F0aW9uRGV0ZWN0aW9uJyxcbiAgICBTZXJ2aWNlOiAnWU9MTycsXG4gICAgRW52aXJvbm1lbnQ6ICdwcm9kdWN0aW9uJyxcbiAgfSxcbn0pO1xuXG5hcHAuc3ludGgoKTtcblxuIl19