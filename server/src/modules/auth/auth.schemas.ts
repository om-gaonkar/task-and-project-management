import { z } from 'zod';

const email = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254, 'Email is too long');

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(80, 'Name must be 80 characters or fewer'),
  email,
  // Length matters more than composition rules, so there is a long minimum and no "must contain
  // a symbol" rule. The maximum only bounds the work a single request can cause.
  password: z
    .string({ required_error: 'Password is required' })
    .min(10, 'Use at least 10 characters')
    .max(128, 'Use 128 characters or fewer'),
});

export const loginSchema = z.object({
  email,
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
    .max(128, 'Password is too long'),
});

export const sessionParamsSchema = z.object({
  sessionId: z.string().regex(/^[0-9a-f]{32}$/, 'Invalid session id'),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
