/* eslint-disable @typescript-eslint/naming-convention */
import { MongoClient } from 'mongodb';
import type { Document } from 'mongodb';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { NONAME } from 'dns';
import { UserDocument, TeamDocument } from './types';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
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

export async function disbandTeam(
  auth_token: string,
  auth_email: string,
  team_id: string
): Promise<{ statusCode: number; body: string }> {
  // token check
  const isValidToken = validateToken(auth_token, process.env.JWT_SECRET!, auth_email);
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
    //db connection + users collection
    const db = MongoDB.getInstance(process.env.MONGO_URI);
    await db.connect();
    const users = db.getCollection<UserDocument>('users');

    const authUser = await users.findOne({ email: auth_email });
    if (!authUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'Auth user not found.',
        }),
      };
    }
    //verify authUser is team leader
    if (!(authUser.team_info.role == 'leader')) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'Auth user not leader.',
        }),
      };
    }
    //get teams collection
    const teams = db.getCollection<TeamDocument>('teams');

    //verify team exists and is not already disbanded
    const team = await teams.findOne({ team_id: team_id });
    if (!team) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'Team does not exist',
        }),
      };
    }

    if (team.status == 'Disbanded') {
      return {
        statusCode: 404,
        body: JSON.stringify({
          statusCode: 404,
          message: 'Team already disbanded.',
        }),
      };
    }

    //clear team_info object for members
    team.members.forEach(async (member_email) => {
      await users.updateOne(
        { email: member_email },
        { $set: { 'team_info.team_id': null, 'team_info.role': null, confirmed_team: false } as any }
      );
    });

    //clear leader's team info
    await users.updateOne(
      { email: auth_email },
      { $set: { 'team_info.team_id': null, 'team_info.role': null, confirmed_team: false } as any }
    );

    const invitations_removed = (await users.find({ 'team_info.pending_invites.team_id': team_id }).toArray()).length;
    const members_affected = team.members.length;

    //remove pending invites from all users
    users.updateMany({ 'team_info.pending_invites.team_id': team_id }, {
      $pull: { 'team_info.pending_invites': { team_id: team_id } },
    } as any);

    //update teams object
    teams.updateOne({ team_id: team_id }, { $set: { status: 'Disbanded', updated: new Date() } });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Team disbanded successfully',
        members_affected: members_affected,
        invitations_removed: invitations_removed,
      }),
    };
  } catch (error) {
    console.error('Error in team disbandment:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Internal server error.',
        error: error.message,
      }),
    };
  }
}
export interface UserDoc {
  first_name: string;
  last_name: string;
  email: string;
  email_verified: boolean;
  password: string;
  role: {
    hacker: boolean;
    volunteer: boolean;
    judge: boolean;
    sponsor: boolean;
    mentor: boolean;
    organizer: boolean;
    director: boolean;
  };
  votes: 0;
  github: string;
  major: string;
  short_answer: string;
  shirt_size: string;
  dietary_restrictions: string;
  special_needs: string;
  date_of_birth: string;
  school: string;
  grad_year: string;
  gender: string;
  level_of_study: string;
  ethnicity: string;
  phone_number: string;
  registration_status: RegistrationStatus;
  day_of: {
    event: Record<
      string,
      {
        attend: number;
        time: string[];
      }
    >;
  };
  discord: {
    user_id: string;
    username: string;
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  created_at: string;
  registered_at: string;
}

type RegistrationStatus =
  | 'unregistered'
  | 'registered'
  | 'rejected'
  | 'confirmation'
  | 'waitlist'
  | 'coming'
  | 'not_coming'
  | 'confirmed'
  | 'checked_in';
