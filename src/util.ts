/* eslint-disable @typescript-eslint/naming-convention */
import { MongoClient } from 'mongodb';
import type { Collection } from 'mongodb';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import AWS from 'aws-sdk';

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
    // const ping = await this.client.db().command({ ping: 1 });
    // if (ping?.ok === 1) {
    //     await this.client.connect();
    // }
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

  public getCollection(name: string): Collection {
    return this.client.db().collection(name);
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

export interface UserProfile {
  role: Record<string, boolean>;
}

export function ensureRoles(user: UserProfile, roles: string[]): boolean {
  for (const role of roles) if (user[role]) return true;

  return false;
}

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

export async function checkIfFileExists(bucketName: string, objectKey: string): Promise<boolean> {
  const s3 = new AWS.S3();

  const params = {
    Bucket: bucketName,
    Key: objectKey,
  };
  try {
    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    if (error.code === 'NotFound') return false;
  }
  return false;
}

export function generatePresignedUrl(bucketName: string, objectKey: string): string {
  const s3 = new AWS.S3();

  const params = {
    Bucket: bucketName,
    Key: objectKey,
    Expires: 3600, // expiration time in seconds (1 hr)
    ContentType: 'application/pdf', // specify the content type
  };

  return s3.getSignedUrl('putObject', params);
}
