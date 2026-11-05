export type SessionStatus = 'active' | 'used' | 'revoked';
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface DeviceInfo {
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  deviceType: DeviceType;
  ipAddress: string | null;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  /** scrypt hash. Absent for accounts that only use Google. Never leaves the service layer. */
  passwordHash?: string;
  googleId?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface NewUser {
  name: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  avatarUrl?: string;
  emailVerified: boolean;
}

export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findByGoogleId(googleId: string): Promise<UserRecord | null>;
  create(input: NewUser): Promise<UserRecord>;
  /** Attaches a Google identity. With dropPassword the local password is removed in the same write. */
  linkGoogle(
    id: string,
    input: { googleId: string; avatarUrl?: string; dropPassword: boolean },
  ): Promise<UserRecord | null>;
  touchLastLogin(id: string, at: Date): Promise<void>;
}

/** One row per refresh token. Every token of a login belongs to one family (the session). */
export interface SessionRecord {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  status: SessionStatus;
  /** When this particular refresh token stops working (sliding window). */
  expiresAt: Date;
  /** When the whole session stops working, however often it was refreshed. */
  sessionExpiresAt: Date;
  sessionCreatedAt: Date;
  createdAt: Date;
  usedAt?: Date;
  revokedAt?: Date;
  device: DeviceInfo;
}

export type NewSession = Omit<SessionRecord, 'id' | 'status' | 'usedAt' | 'revokedAt'>;

export interface SessionSummary {
  familyId: string;
  device: DeviceInfo;
  sessionCreatedAt: Date;
  lastActiveAt: Date;
  sessionExpiresAt: Date;
}

export interface SessionRepository {
  create(input: NewSession): Promise<SessionRecord>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  /** Atomic active -> used. Returns false when the token was no longer active (a concurrent use). */
  markUsed(id: string, at: Date): Promise<boolean>;
  revokeFamily(familyId: string, at: Date): Promise<void>;
  /** Returns how many tokens were revoked, so callers can tell "no such session" apart. */
  revokeFamilyForUser(userId: string, familyId: string, at: Date): Promise<number>;
  revokeAllForUser(userId: string, at: Date): Promise<number>;
  hasActiveSession(familyId: string, now: Date): Promise<boolean>;
  listActive(userId: string, now: Date): Promise<SessionSummary[]>;
}

/** The user as the browser sees them. Built by toPublicUser(), which is the only way out. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  providers: Array<'password' | 'google'>;
  createdAt: string;
}

export interface IssuedSession {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  session: IssuedSession;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl?: string;
}
