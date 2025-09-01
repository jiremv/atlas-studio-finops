#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FinopsCurStack } from '../lib/finops-cur-stack';
import { GrafanaFargateStack } from '../lib/grafana-fargate-stack';

const app = new cdk.App();

// IMPORTANT: deploy in us-east-1 for CUR definition
new FinopsCurStack(app, 'AtlasStudioFinOps-CUR', {
  env: { region: 'us-east-1' }
});

// Optional: Grafana self-hosted on ECS Fargate
new GrafanaFargateStack(app, 'AtlasStudioFinOps-Grafana', {
  env: { region: 'us-east-1' }
});
