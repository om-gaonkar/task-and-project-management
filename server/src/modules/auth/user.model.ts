import { model, Schema, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    // Excluded from queries by default. Repositories opt in with select('+passwordHash').
    passwordHash: { type: String, select: false },
    googleId: { type: String },
    avatarUrl: { type: String, trim: true, maxlength: 2048 },
    emailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

// Partial rather than sparse: a sparse index still indexes an explicit null, so two password-only
// users would collide. Here only documents that actually have a string googleId are indexed.
userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } },
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
