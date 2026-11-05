import { model, Schema, type InferSchemaType } from 'mongoose';

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    familyId: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ['active', 'used', 'revoked'], default: 'active' },
    expiresAt: { type: Date, required: true },
    sessionExpiresAt: { type: Date, required: true },
    sessionCreatedAt: { type: Date, required: true },
    usedAt: { type: Date },
    revokedAt: { type: Date },
    device: {
      userAgent: { type: String, default: null },
      browser: { type: String, default: null },
      os: { type: String, default: null },
      deviceType: {
        type: String,
        enum: ['desktop', 'mobile', 'tablet', 'unknown'],
        default: 'unknown',
      },
      ipAddress: { type: String, default: null },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

sessionSchema.index({ userId: 1, status: 1 });
sessionSchema.index({ familyId: 1, status: 1 });
// MongoDB deletes the row shortly after expiresAt, so the collection does not grow forever.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDocument = InferSchemaType<typeof sessionSchema>;
export const SessionModel = model('RefreshToken', sessionSchema);
