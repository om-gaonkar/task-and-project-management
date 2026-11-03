import type { RequestHandler } from 'express';
import { sendSuccess } from '../../shared/utils/response';
import { assertReady, getLiveness } from './health.service';

export const getHealth: RequestHandler = (_req, res) => {
  sendSuccess(res, getLiveness());
};

export const getReadiness: RequestHandler = (_req, res) => {
  sendSuccess(res, assertReady());
};
