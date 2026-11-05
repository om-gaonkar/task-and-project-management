import { randomUUID } from 'node:crypto';
import type {
  NewSession,
  NewUser,
  SessionRecord,
  SessionRepository,
  UserRecord,
  UserRepository,
} from '../../modules/auth/auth.types';

/** In-memory stand-ins for the Mongo repositories, so auth logic is tested without a database. */
export function createMemoryUsers() {
  const rows = new Map<string, UserRecord>();

  const repository: UserRepository = {
    async findById(id) {
      return rows.get(id) ?? null;
    },
    async findByEmail(email) {
      return [...rows.values()].find((user) => user.email === email.toLowerCase()) ?? null;
    },
    async findByGoogleId(googleId) {
      return [...rows.values()].find((user) => user.googleId === googleId) ?? null;
    },
    async create(input: NewUser) {
      const user: UserRecord = {
        id: randomUUID(),
        isActive: true,
        createdAt: new Date(),
        ...input,
        email: input.email.toLowerCase(),
      };
      rows.set(user.id, user);
      return user;
    },
    async linkGoogle(id, { googleId, avatarUrl, dropPassword }) {
      const user = rows.get(id);
      if (!user) return null;
      const updated: UserRecord = {
        ...user,
        googleId,
        emailVerified: true,
        avatarUrl: avatarUrl ?? user.avatarUrl,
        passwordHash: dropPassword ? undefined : user.passwordHash,
      };
      rows.set(id, updated);
      return updated;
    },
    async touchLastLogin() {},
  };

  return { rows, repository };
}

export function createMemorySessions() {
  const rows = new Map<string, SessionRecord>();

  const repository: SessionRepository = {
    async create(input: NewSession) {
      const record: SessionRecord = { id: randomUUID(), status: 'active', ...input };
      rows.set(record.id, record);
      return record;
    },
    async findByTokenHash(tokenHash) {
      return [...rows.values()].find((row) => row.tokenHash === tokenHash) ?? null;
    },
    async markUsed(id, at) {
      const row = rows.get(id);
      if (!row || row.status !== 'active') return false;
      row.status = 'used';
      row.usedAt = at;
      return true;
    },
    async revokeFamily(familyId, at) {
      for (const row of rows.values()) {
        if (row.familyId === familyId && row.status !== 'revoked') {
          row.status = 'revoked';
          row.revokedAt = at;
        }
      }
    },
    async revokeFamilyForUser(userId, familyId, at) {
      let count = 0;
      for (const row of rows.values()) {
        if (row.userId === userId && row.familyId === familyId && row.status !== 'revoked') {
          row.status = 'revoked';
          row.revokedAt = at;
          count += 1;
        }
      }
      return count;
    },
    async revokeAllForUser(userId, at) {
      let count = 0;
      for (const row of rows.values()) {
        if (row.userId === userId && row.status !== 'revoked') {
          row.status = 'revoked';
          row.revokedAt = at;
          count += 1;
        }
      }
      return count;
    },
    async hasActiveSession(familyId, now) {
      return [...rows.values()].some(
        (row) =>
          row.familyId === familyId &&
          row.status === 'active' &&
          row.expiresAt > now &&
          row.sessionExpiresAt > now,
      );
    },
    async listActive(userId, now) {
      return [...rows.values()]
        .filter(
          (row) =>
            row.userId === userId &&
            row.status === 'active' &&
            row.expiresAt > now &&
            row.sessionExpiresAt > now,
        )
        .map((row) => ({
          familyId: row.familyId,
          device: row.device,
          sessionCreatedAt: row.sessionCreatedAt,
          lastActiveAt: row.createdAt,
          sessionExpiresAt: row.sessionExpiresAt,
        }));
    },
  };

  return { rows, repository };
}
