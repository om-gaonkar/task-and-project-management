import { getDatabaseState, isDatabaseConnected, type DatabaseState } from '../../config/database';
import { serviceUnavailable } from '../../shared/errors/app-error';

export interface HealthStatus {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
  database: { state: DatabaseState };
}

/** Liveness: the process is up. Includes database state for information only. */
export function getLiveness(): HealthStatus {
  return {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: { state: getDatabaseState() },
  };
}

/** Readiness: throws 503 unless the database connection is usable. */
export function assertReady(): { ready: true } {
  if (!isDatabaseConnected()) {
    throw serviceUnavailable('The database is not connected');
  }
  return { ready: true };
}
