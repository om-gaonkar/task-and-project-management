export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  providers: Array<'password' | 'google'>;
  createdAt: string;
}

/** What login, register and refresh all return. The refresh token itself stays in a cookie. */
export interface SessionPayload {
  user: AuthUser;
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  name: string;
}
