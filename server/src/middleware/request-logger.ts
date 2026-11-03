import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import { logger } from '../config/logger';
import { API_PREFIX, REQUEST_ID_HEADER } from '../shared/constants';

const SAFE_REQUEST_ID = /^[\w-]{8,64}$/;

/**
 * Adds req.id / req.log and the X-Request-Id response header. Only the method, path (no query
 * string) and status are logged; headers and bodies are never part of the log line.
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId(req, res) {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const id =
      typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  autoLogging: {
    ignore: (req) => req.url === `${API_PREFIX}/health`,
  },
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, path: String(req.url ?? '').split('?')[0] }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
