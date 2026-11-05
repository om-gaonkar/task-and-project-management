import type { Types } from 'mongoose';
import type { NewUser, UserRecord, UserRepository } from './auth.types';
import { UserModel, type UserDocument } from './user.model';

type UserRow = UserDocument & { _id: Types.ObjectId; createdAt: Date };

function toRecord(row: UserRow): UserRecord {
  return {
    id: row._id.toString(),
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash ?? undefined,
    googleId: row.googleId ?? undefined,
    avatarUrl: row.avatarUrl ?? undefined,
    emailVerified: row.emailVerified,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

async function findOne(filter: Record<string, unknown>): Promise<UserRecord | null> {
  const row = await UserModel.findOne(filter).select('+passwordHash').lean<UserRow>();
  return row ? toRecord(row) : null;
}

export const mongoUserRepository: UserRepository = {
  async findById(id) {
    // An id that is not a valid ObjectId cannot match, so skip the query instead of throwing.
    if (!/^[0-9a-f]{24}$/i.test(id)) return null;
    return findOne({ _id: id });
  },

  findByEmail: (email) => findOne({ email: email.toLowerCase() }),

  findByGoogleId: (googleId) => findOne({ googleId }),

  async create(input: NewUser) {
    const created = await UserModel.create(input);
    // select:false only affects queries, so the freshly created document still carries the hash.
    return toRecord(created.toObject() as UserRow);
  },

  async linkGoogle(id, { googleId, avatarUrl, dropPassword }) {
    const update: Record<string, unknown> = {
      $set: { googleId, emailVerified: true, ...(avatarUrl ? { avatarUrl } : {}) },
      ...(dropPassword ? { $unset: { passwordHash: '' } } : {}),
    };
    const row = await UserModel.findByIdAndUpdate(id, update, { new: true })
      .select('+passwordHash')
      .lean<UserRow>();
    return row ? toRecord(row) : null;
  },

  async touchLastLogin(id, at) {
    await UserModel.updateOne({ _id: id }, { $set: { lastLoginAt: at } });
  },
};
