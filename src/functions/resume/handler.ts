import type { ValidatedEventAPIGatewayProxyEvent } from '@libs/api-gateway';
//import { SuccessJSONResponse, FailureJSONResponse } from '@libs/api-gateway';
import { middyfy } from '@libs/lambda';

import schema from './schema';
import { validateToken, checkIfFileExists, generatePresignedUrl } from '../../util';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const resume: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (event) => {
  try {
    const isValidToken = validateToken(event.body.auth_token, process.env.JWT_SECRET, event.body.email);
    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: 'Unauthorized',
        }),
      };
    }

    // need to check if the user has already submitted a resume
    if (await checkIfFileExists(process.env.RESUME_BUCKET, `${event.body.email}.pdf`)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'You already submitted a resume',
        }),
      };
    }

    // provide a pre-signed url in the return body
    const presignedUrl = await generatePresignedUrl(process.env.RESUME_BUCKET, `${event.body.email}.pdf`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Upload the resume through the generated URL. (Use "PUT" method)',
        url: presignedUrl,
      }),
    };
  } catch (error) {
    console.error('Error uploading resume', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error.',
        error,
      }),
    };
  }
};

export const main = middyfy(resume);
