import { api } from '@/lib/api-client';

export type DatabaseState =
  'connected' | 'disconnected' | 'connecting' | 'disconnecting' | 'uninitialized' | 'unknown';

export interface HealthStatus {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
  database: { state: DatabaseState };
}

export const systemKeys = {
  all: ['system'] as const,
  health: () => [...systemKeys.all, 'health'] as const,
};

export function getHealth(signal?: AbortSignal): Promise<HealthStatus> {
  return api.get<HealthStatus>('/health', { signal });
}
