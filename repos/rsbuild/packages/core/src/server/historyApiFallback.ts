/**
 * This module is modified based on source found in
 * https://github.com/bripkens/connect-history-api-fallback
 *
 * MIT Licensed
 * Copyright (c) 2022 Ben Blackmore and contributors
 * https://github.com/bripkens/connect-history-api-fallback/blob/master/LICENSE
 */
import type { IncomingMessage } from 'node:http';
import { URL } from 'node:url';
import { LOCALHOST } from '../constants';
import type { Logger } from '../logger';
import type { HistoryApiFallbackOptions, RequestHandler } from '../types';

export function historyApiFallbackMiddleware(
  logger: Logger,
  options: HistoryApiFallbackOptions = {},
): RequestHandler {
  return function historyApiFallbackMiddleware(req, _res, next) {
    const { headers } = req;

    if (!req.url) {
      next();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      logger.debug('Not rewriting', req.method, req.url, 'because the method is not GET or HEAD.');
      next();
      return;
    }

    if (!headers || typeof headers.accept !== 'string') {
      logger.debug(
        'Not rewriting',
        req.method,
        req.url,
        'because the client did not send an HTTP accept header.',
      );
      next();
      return;
    }

    if (headers.accept.startsWith('application/json')) {
      logger.debug('Not rewriting', req.method, req.url, 'because the client prefers JSON.');
      next();
      return;
    }

    const rewrites = options.rewrites || [];
    const htmlAcceptHeaders = options.htmlAcceptHeaders || ['text/html', '*/*'];
    const { accept } = headers;

    if (!htmlAcceptHeaders.some((item) => accept.includes(item))) {
      logger.debug(
        'Not rewriting',
        req.method,
        req.url,
        'because the client does not accept HTML.',
      );
      next();
      return;
    }

    const parsedUrl = parseReqUrl(req);

    // skip invalid request
    if (parsedUrl === null) {
      next();
      return;
    }

    let rewriteTarget: string;

    for (const rewrite of rewrites) {
      const match = parsedUrl.pathname?.match(rewrite.from);
      if (!match) {
        continue;
      }

      const rule = rewrite.to;
      rewriteTarget = typeof rule === 'string' ? rule : rule({ parsedUrl, match, request: req });

      if (!rewriteTarget.startsWith('/')) {
        logger.debug(
          'We recommend using an absolute path for the rewrite target.',
          'Received a non-absolute rewrite target',
          rewriteTarget,
          'for URL',
          req.url,
        );
      }

      logger.debug('Rewriting', req.method, req.url, 'to', rewriteTarget);
      req.url = rewriteTarget;
      next();
      return;
    }

    const { pathname } = parsedUrl;
    if (
      pathname &&
      pathname.lastIndexOf('.') > pathname.lastIndexOf('/') &&
      options.disableDotRule !== true
    ) {
      logger.debug(
        'Not rewriting',
        req.method,
        req.url,
        'because the path includes a dot (.) character.',
      );
      next();
      return;
    }

    const index = options.index || '/index.html';
    logger.debug('Rewriting', req.method, req.url, 'to', index);
    req.url = index;
    next();
  };
}

function parseReqUrl(req: IncomingMessage) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || LOCALHOST;
  try {
    return new URL(req.url || '/', `${proto}://${host}`);
  } catch {
    return null;
  }
}
