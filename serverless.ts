import type { AWS } from '@serverless/typescript';

import hello from '@functions/hello';
<<<<<<< HEAD
import check_registration from '@functions/check_registration';
import attend_event from '@functions/attend_event';
=======
import checkRegistration from '@functions/check-registration';
import authorize from '@functions/authorize';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
>>>>>>> 603826d71afa76ff6212871ab7c610ba4de922c1

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
<<<<<<< HEAD
  functions: { hello, check_registration, attend_event },
=======
  functions: { hello, checkRegistration, authorize },
>>>>>>> 603826d71afa76ff6212871ab7c610ba4de922c1
  package: { individually: true },
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
