// discord integration

import fetch from 'node-fetch';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const discordURL = 'https://discord.com/api/v10';

export async function getDiscordTokens(code: string) {
  const resp = await fetch(discordURL + '/oauth2/token', {
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
    }),
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (resp.ok) {
    const data = (await resp.json()) as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  } else {
    throw new Error(`Error fetching discord token: [${resp.status}] ${resp.statusText}`);
  }
}

export async function refreshAccessToken(refreshToken: string) {
  const resp = await fetch(discordURL + '/oauth2/token', {
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (resp.ok) {
    const data = (await resp.json()) as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  } else {
    throw new Error(`Error refreshing discord token: [${resp.status}] ${resp.statusText}`);
  }
}

export async function getDiscordUser(token: string) {
  const resp = await fetch(discordURL + '/oauth2/@me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (resp.ok) {
    const data = (await resp.json()) as any;
    return {
      userId: data.user.id,
      username: data.user.username,
    };
  } else {
    throw new Error(`Error fetching discord user: [${resp.status}] ${resp.statusText}`);
  }
}

export async function updateDiscordMetadata(token: string, name: string, metadata: DiscordMetadata) {
  const resp = await fetch(discordURL + `/users/@me/applications/${process.env.DISCORD_CLIENT_ID}/role-connection`, {
    body: JSON.stringify({
      platform_name: 'HackRU',
      platform_username: name,
      metadata,
    }),
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!resp.ok) {
    throw new Error(`Error updating discord metadata: [${resp.status}] ${resp.statusText}`);
  }
}

interface DiscordMetadata {
  verified?: string; // datetime ISO string
  checkedIn?: 0 | 1; // 0 = false, 1 = true
}
