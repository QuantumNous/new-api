import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';

function extractQueryToken(request: Request): string {
  const candidates = [
    request.query.monitor_api_token,
    request.query.MONITOR_API_TOKEN,
    request.query.api_token,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

export function extractToken(request: Request): string {
  const authHeader = request.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  return request.header('x-api-key')?.trim() || extractQueryToken(request);
}

export function hasValidMonitorApiToken(request: Request): boolean {
  if (!config.monitorApiToken) {
    return false;
  }

  return extractToken(request) === config.monitorApiToken;
}

export function requireApiToken(request: Request, response: Response, next: NextFunction): void {
  if (!config.monitorApiToken) {
    next();
    return;
  }

  if (request.path === '/key/quota' || request.path === '/channel/records' || request.path === '/user/quota') {
    next();
    return;
  }

  if (!hasValidMonitorApiToken(request)) {
    response.status(401).json({
      message: 'Unauthorized',
    });
    return;
  }

  next();
}
