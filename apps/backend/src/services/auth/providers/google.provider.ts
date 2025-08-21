import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library/build/src/auth/oauth2client';
import { ProvidersInterface } from '@gitroom/backend/services/auth/providers.interface';

const createOAuthClient = () => {
  const client = new google.auth.OAuth2({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/oauth/callback/GOOGLE`,
  });

  const oauth2 = (newClient: OAuth2Client) =>
    google.oauth2({
      version: 'v2',
      auth: newClient,
    });

  return { client, oauth2 };
};

export class GoogleProvider implements ProvidersInterface {
  generateLink() {
    const state = makeId(7);
    const { client } = createOAuthClient();
    const redirectUri = `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/oauth/callback/GOOGLE`;
    const authUrl = client.generateAuthUrl({
      access_type: 'online',
      prompt: 'consent',
      state,
      redirect_uri: redirectUri,
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    });
    console.log('Generated Google OAuth URL:', { authUrl, redirectUri, clientId: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...' });
    return authUrl;
  }

  async getToken(code: string) {
    const { client } = createOAuthClient();
    console.log('Exchanging code for token:', { code: code.substring(0, 10) + '...', redirectUri: process.env.NEXT_PUBLIC_BACKEND_URL + '/auth/oauth/callback/GOOGLE' });
    try {
      const { tokens } = await client.getToken(code);
      console.log('Token exchange successful');
      return tokens.access_token;
    } catch (error) {
      console.error('Token exchange failed:', error);
      throw error;
    }
  }

  async getUser(providerToken: string) {
    const { client, oauth2 } = createOAuthClient();
    client.setCredentials({ access_token: providerToken });
    const user = oauth2(client);
    const { data } = await user.userinfo.get();

    return {
      id: data.id!,
      email: data.email,
    };
  }
}
