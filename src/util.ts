/* eslint-disable @typescript-eslint/naming-convention */
import { MongoClient } from 'mongodb';
import type { Document } from 'mongodb';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// cache connection so only one copy is used
export class MongoDB {
  private static instance: MongoDB;
  private client: MongoClient;

  private constructor(uri: string) {
    this.client = new MongoClient(uri);
  }

  public static getInstance(uri: string): MongoDB {
    if (!MongoDB.instance) MongoDB.instance = new MongoDB(uri);

    return MongoDB.instance;
  }

  public async connect(): Promise<void> {
    try {
      await this.client.db().command({ ping: 1 });
      // Ping was successful
    } catch (error) {
      // An error occurred while pinging the database
      await this.client.connect();
    }
  }

  public getClient(): MongoClient {
    return this.client;
  }

  public getCollection<T extends Document>(name: string) {
    return this.client.db().collection<T>(name);
  }
}

export function validateToken(token: string, secretKey: string, authEmail: string): boolean {
  try {
    const decoded = jwt.verify(token, secretKey) as JwtPayload;
    if (authEmail !== decoded.email) return false;
    return true;
  } catch (error) {
    console.error('Invalid token:', error);
    return false;
  }
}

export function verifyEmailCode(token: string, secretKey: string): string | boolean {
  try {
    const decoded = jwt.verify(token, secretKey) as JwtPayload;
    return decoded.email;
  } catch (error) {
    console.error('Invalid token:', error);
    return false;
  }
}

export function ensureRoles(userRoles: Record<string, boolean>, roles: string[]): boolean {
  for (const role of roles) if (userRoles[role]) return true;

  return false;
}

export async function checkIfFileExists(bucketName: string, objectKey: string): Promise<boolean> {
  try {
    const params = {
      Bucket: bucketName,
      Key: objectKey,
    };
    const s3 = new S3Client();
    const command = new HeadObjectCommand(params);
    await s3.send(command);
    return true;
  } catch (error) {
    if (error.code === 'NotFound') return false;
  }
  return false;
}

export async function generatePresignedUrl(bucketName: string, objectKey: string): Promise<string> {
  const s3 = new S3Client();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ContentType: 'application/pdf', // specify the content type
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return url;
}

export async function userExistsLogic(
  authEmail: string,
  authToken: string,
  lookupEmail: string
): Promise<{ statusCode: number; body: string }> {
  // token check
  const isValidToken = validateToken(authToken, process.env.JWT_SECRET!, authEmail);
  if (!isValidToken) {
    return {
      statusCode: 401,
      body: JSON.stringify({
        statusCode: 401,
        message: 'Unauthorized',
      }),
    };
  }

  try {
    // connect + grab users
    const db = MongoDB.getInstance(process.env.MONGO_URI!);
    await db.connect();
    const users = db.getCollection('users');

    // auth user exists?
    const authUser = await users.findOne({ email: authEmail });
    if (!authUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'Auth user not found.',
        }),
      };
    }

    // lookup user exists?
    const lookupUser = await users.findOne(
      { email: lookupEmail.toLowerCase() },
      { projection: { password: 0, _id: 0 } }
    );
    if (!lookupUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'Look-up user was not found',
        }),
      };
    }

    // all good
    return {
      statusCode: 200,
      body: JSON.stringify('User exists'),
    };
  } catch (error) {
    console.error('Error reading user:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Internal server error.',
        error,
      }),
    };
  }
}
