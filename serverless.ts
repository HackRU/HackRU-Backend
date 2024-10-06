import type { AWS } from '@serverless/typescript';

import hello from '@functions/hello';
import create from '@functions/create';
import update from '@functions/update';
import authorize from '@functions/authorize';
import attendEvent from '@functions/attend-event';
import discord from '@functions/discord';
import read from '@functions/read';
import waiver from '@functions/waiver';
import resume from '@functions/resume';
import resetPassword from '@functions/reset-password';
import forgotPassword from '@functions/forgot-password';
import leaderboard from '@functions/leaderboard';
import points from '@functions/points';
import getBuyIns from '@functions/get-buy-ins';

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
    stage: process.env.STAGE,
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
  functions: {
    hello,
    create,
    authorize,
    update,
    attendEvent,
    waiver,
    resume,
    read,
    discord,
    forgotPassword,
    resetPassword,
    leaderboard,
    points,
    getBuyIns,
  },
  package: { individually: true, patterns: ['!.env*', '.env.vault'] },
  custom: {
    esbuild: {
      bundle: true,
      minify: false,
      sourcemap: true,
      exclude: [],
      target: 'node14',
      define: { 'require.resolve': undefined },
      platform: 'node',
      concurrency: 10,
    },
  },
};

module.exports = serverlessConfiguration;
