import { MongoClient } from 'mongodb';
import type { Collection } from 'mongodb';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

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
    if (authEmail !== decoded.email)
      return false;
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
  for (const role of roles) {
    if (user.role[role])
      return true;
  }
  return false;
}