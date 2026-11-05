import { randomBytes } from 'node:crypto';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { serviceUnavailable, unauthorized } from '../../shared/errors/app-error';
import type { GoogleProfile } from './auth.types';

export interface GoogleAuthorization {
  url: string;
  state: string;
  codeVerifier: string;
}

export interface GoogleProvider {
  readonly configured: boolean;
  createAuthorization(): Promise<GoogleAuthorization>;
  exchangeCode(code: string, codeVerifier: string): Promise<GoogleProfile>;
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

/**
 * Authorization code flow with PKCE. The identity comes from the signed ID token that Google
 * returns, verified against our client id, rather than from a separate userinfo request.
 */
export function createGoogleProvider(config: GoogleConfig | null): GoogleProvider {
  if (!config) {
    const unavailable = () => {
      throw serviceUnavailable('Google sign-in is not configured');
    };
    return { configured: false, createAuthorization: unavailable, exchangeCode: unavailable };
  }

  const client = new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.callbackUrl,
  });

  return {
    configured: true,

    async createAuthorization() {
      const state = randomBytes(32).toString('base64url');
      const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
      const url = client.generateAuthUrl({
        scope: ['openid', 'email', 'profile'],
        state,
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
        prompt: 'select_account',
      });
      if (!codeVerifier) throw serviceUnavailable('Could not start Google sign-in');
      return { url, state, codeVerifier };
    },

    async exchangeCode(code, codeVerifier) {
      const { tokens } = await client.getToken({ code, codeVerifier });
      if (!tokens.id_token) throw unauthorized('Google did not return an identity token');

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email)
        throw unauthorized('Google did not share an email address');

      return {
        googleId: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: payload.email_verified === true,
        name: payload.name?.trim() || payload.email.split('@')[0] || 'Daybook user',
        avatarUrl: payload.picture,
      };
    },
  };
}
