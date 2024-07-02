import type { AWS } from '@serverless/typescript';

import hello from '@functions/hello';
import create from '@functions/create';
import update from '@functions/update';
import authorize from '@functions/authorize';
import attendEvent from '@functions/attend-event';
import discord from '@functions/discord';

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serverlessConfiguration: AWS = {
  service: 'hackru-backend',
  frameworkVersion: '3',
  plugins: ['serverless-esbuild', 'serverless-offline'],
  provider: {
    name: 'aws',
    runtime: 'nodejs20.x',
    stage: 'dev',
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      NODE_OPTIONS: '--enable-source-maps --stack-trace-limit=1000',
      DOTENV_KEY: process.env.DOTENV_KEY,
    },
  },
  // import the function via paths
  functions: { hello, create, authorize, update, attendEvent, discord },
  package: { individually: true, patterns: ['!.env*', '.env.vault'] },
  custom: {
    esbuild: {
      bundle: true,
      minify: false,
      sourcemap: true,
      exclude: ['aws-sdk'],
      target: 'node14',
      define: { 'require.resolve': undefined },
      platform: 'node',
      concurrency: 10,
    },
  },
};

module.exports = serverlessConfiguration;
