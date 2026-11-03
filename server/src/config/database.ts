import mongoose from 'mongoose';
import { logger } from './logger';

export type DatabaseState =
  'disconnected' | 'connected' | 'connecting' | 'disconnecting' | 'uninitialized' | 'unknown';

const READY_STATES: Record<number, DatabaseState> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
};

let listenersAttached = false;

function attachListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
}

/** Called exactly once from server.ts. Request handlers must never connect. */
export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  attachListeners();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 10 });
  // The URI can contain credentials, so it is deliberately not logged.
  logger.info('MongoDB connected');
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function getDatabaseState(): DatabaseState {
  return READY_STATES[mongoose.connection.readyState] ?? 'unknown';
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
