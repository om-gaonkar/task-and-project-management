import { Types } from 'mongoose';
import type { DeviceInfo, SessionRecord, SessionRepository } from './auth.types';
import { SessionModel, type SessionDocument } from './session.model';

type SessionRow = SessionDocument & { _id: Types.ObjectId; createdAt: Date };

function toDevice(device: SessionRow['device']): DeviceInfo {
  return {
    userAgent: device?.userAgent ?? null,
    browser: device?.browser ?? null,
    os: device?.os ?? null,
    deviceType: device?.deviceType ?? 'unknown',
    ipAddress: device?.ipAddress ?? null,
  };
}

function toRecord(row: SessionRow): SessionRecord {
  return {
    id: row._id.toString(),
    userId: row.userId.toString(),
    familyId: row.familyId,
    tokenHash: row.tokenHash,
    status: row.status ?? 'active',
    expiresAt: row.expiresAt,
    sessionExpiresAt: row.sessionExpiresAt,
    sessionCreatedAt: row.sessionCreatedAt,
    createdAt: row.createdAt,
    usedAt: row.usedAt ?? undefined,
    revokedAt: row.revokedAt ?? undefined,
    device: toDevice(row.device),
  };
}

const notRevoked = { status: { $ne: 'revoked' } } as const;

export const mongoSessionRepository: SessionRepository = {
  async create(input) {
    const created = await SessionModel.create({
      ...input,
      userId: new Types.ObjectId(input.userId),
    });
    return toRecord(created.toObject() as SessionRow);
  },

  async findByTokenHash(tokenHash) {
    const row = await SessionModel.findOne({ tokenHash }).lean<SessionRow>();
    return row ? toRecord(row) : null;
  },

  async markUsed(id, at) {
    // The status filter makes this a compare-and-swap: only one concurrent caller can match.
    const result = await SessionModel.updateOne(
      { _id: id, status: 'active' },
      { $set: { status: 'used', usedAt: at } },
    );
    return result.modifiedCount === 1;
  },

  async revokeFamily(familyId, at) {
    await SessionModel.updateMany(
      { familyId, ...notRevoked },
      { $set: { status: 'revoked', revokedAt: at } },
    );
  },

  async revokeFamilyForUser(userId, familyId, at) {
    if (!Types.ObjectId.isValid(userId)) return 0;
    const result = await SessionModel.updateMany(
      { userId: new Types.ObjectId(userId), familyId, ...notRevoked },
      { $set: { status: 'revoked', revokedAt: at } },
    );
    return result.modifiedCount;
  },

  async revokeAllForUser(userId, at) {
    if (!Types.ObjectId.isValid(userId)) return 0;
    const result = await SessionModel.updateMany(
      { userId: new Types.ObjectId(userId), ...notRevoked },
      { $set: { status: 'revoked', revokedAt: at } },
    );
    return result.modifiedCount;
  },

  async hasActiveSession(familyId, now) {
    const found = await SessionModel.exists({
      familyId,
      status: 'active',
      expiresAt: { $gt: now },
      sessionExpiresAt: { $gt: now },
    });
    return found !== null;
  },

  async listActive(userId, now) {
    if (!Types.ObjectId.isValid(userId)) return [];
    // A session has exactly one active token (the latest), so no grouping is needed.
    const rows = await SessionModel.find({
      userId: new Types.ObjectId(userId),
      status: 'active',
      expiresAt: { $gt: now },
      sessionExpiresAt: { $gt: now },
    })
      .sort({ sessionCreatedAt: -1 })
      .lean<SessionRow[]>();
    return rows.map((row) => ({
      familyId: row.familyId,
      device: toDevice(row.device),
      sessionCreatedAt: row.sessionCreatedAt,
      lastActiveAt: row.createdAt,
      sessionExpiresAt: row.sessionExpiresAt,
    }));
  },
};
