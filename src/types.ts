export interface TeamInvite {
  team_id: string;
  invited_by: string;
  invited_at: Date;
  team_name: string;
}

export interface Failure {
  email: string;
  reason: string;
}

export interface UserTeamInfo {
  team_id: string | null;
  role: TeamRole | null;
  pending_invites: TeamInvite[];
}

export interface TeamDocument {
  team_id: string;
  leader_email: string;
  members: string[];
  status: TeamStatus;
  team_name: string;
  created: Date;
  updated: Date;
}

export interface UserDocument {
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
  confirmed_team?: boolean;
  team_info?: UserTeamInfo;
  created_at: string;
  registered_at: string;
}

export enum RegistrationStatus {
  UNREGISTERED = 'unregistered',
  REGISTERED = 'registered',
  REJECTED = 'rejected',
  CONFIRMATION = 'confirmation',
  WAITLIST = 'waitlist',
  COMING = 'coming',
  NOT_COMING = 'not_coming',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
}

export enum TeamRole {
  LEADER = 'leader',
  MEMBER = 'member',
}

export enum TeamStatus {
  ACTIVE = 'Active',
  DISBANDED = 'Disbanded',
}
