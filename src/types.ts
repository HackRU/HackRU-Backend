export interface TeamInvite {
  team_id: string;
  invited_by: string;
  invited_at: Date;
  team_name: string;
}

export interface UserTeamInfo {
  team_id: string | null;
  role: 'leader' | 'member' | null;
  pending_invites: TeamInvite[];
}

export interface UserDocument {
  email: string;
  confirmed_team?: boolean;
  team_info?: UserTeamInfo;
  [key: string]: unknown;
}

export interface TeamDocument {
  team_id: string;
  leader_email: string;
  members: string[];
  status: 'Active' | 'Disbanded';
  team_name: string;
  created: Date;
  updated: Date;
}