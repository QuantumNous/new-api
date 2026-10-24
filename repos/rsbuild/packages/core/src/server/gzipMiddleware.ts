import type { OutgoingHttpHeader, OutgoingHttpHeaders, ServerResponse } from 'node:http';
import zlib from 'node:zlib';
import type { CompressOptions, RequestHandler } from '../types';

const ENCODING_REGEX = /\bgzip\b/;
const CONTENT_TYPE_REGEX = /text|javascript|\/json|xml/i;
type WriteHeadHeaders = OutgoingHttpHeaders | OutgoingHttpHeader[];

const getMimeType = (contentType: string) => contentType.split(';', 1)[0].trim().toLowerCase();

const setWriteHeadHeaders = (res: ServerResponse, headers: WriteHeadHeaders) => {
  if (Array.isArray(headers)) {
    const seen = new Set<string>();

    for (let index = 0; index < headers.length; index += 2) {
      const key = String(headers[index]);
      const value = headers[index + 1];

      if (value !== undefined) {
        const lowerKey = key.toLowerCase();
        if (!seen.has(lowerKey)) {
          seen.add(lowerKey);
          res.removeHeader(key);
        }

        res.appendHeader(key, Array.isArray(value) ? value : String(value));
      }
    }
    return;
  }

  for (const key of Object.keys(headers)) {
    const value = headers[key];

    if (value !== undefined) {
      res.setHeader(key, value);
    }
  }
};

const shouldCompress = (res: ServerResponse) => {
  // already compressed
  if (res.getHeader('Content-Encoding')) {
    return false;
  }

  const contentType = res.getHeader('Content-Type');
  if (!contentType) {
    return false;
  }

  const contentTypeValue = String(contentType);

  // Only compress text-like responses by default to avoid transforming binary assets.
  if (!CONTENT_TYPE_REGEX.test(contentTypeValue)) {
    return false;
  }

  // SSE is text-like, but gzip buffering can delay event delivery.
  if (getMimeType(contentTypeValue) === 'text/event-stream') {
    return false;
  }

  const size = res.getHeader('Content-Length');
  return size === undefined || Number(size) > 1024;
};

export function gzipMiddleware({
  filter,
  level = zlib.constants.Z_BEST_SPEED,
}: CompressOptions = {}): RequestHandler {
  return function gzipMiddleware(req, res, next): void {
    if (filter && !filter(req, res)) {
      next();
      return;
    }

    const accept = req.headers['accept-encoding'];
    const encoding = typeof accept === 'string' && ENCODING_REGEX.test(accept);

    if (req.method === 'HEAD' || !encoding) {
      next();
      return;
    }

    let gzip: zlib.Gzip | undefined;
    let started = false;
    let writeHeadStatus: number | undefined;
    let writeHeadMessage: string | undefined;

    const on = res.on.bind(res);
    const end = res.end.bind(res);
    const write = res.write.bind(res);
    const writeHead = res.writeHead.bind(res);
    const listeners: [string | symbol, (...args: any[]) => void][] = [];

    const start = () => {
      if (started) {
        return;
      }
      started = true;

      const compress = shouldCompress(res);
      if (compress) {
        res.setHeader('Content-Encoding', 'gzip');
        res.removeHeader('Content-Length');

        gzip = zlib.createGzip({ level });

        gzip.on('data', (chunk) => {
          if (!write(chunk)) {
            gzip!.pause();
          }
        });

        on('drain', () => gzip!.resume());

        gzip.on('end', () => {
          end();
        });

        for (const listener of listeners) {
          gzip.on(...listener);
        }
      } else {
        for (const listener of listeners) {
          on.apply(res, listener);
        }
      }

      const statusCode = writeHeadStatus ?? res.statusCode;

      if (writeHeadMessage !== undefined) {
        writeHead(statusCode, writeHeadMessage);
      } else {
        writeHead(statusCode);
      }
    };

    res.writeHead = (
      status: number,
      reason?: string | WriteHeadHeaders,
      headers?: WriteHeadHeaders,
    ) => {
      writeHeadStatus = status;
      writeHeadMessage = typeof reason === 'string' ? reason : undefined;

      const resolvedHeaders = typeof reason === 'string' ? headers : reason;
      if (resolvedHeaders) {
        setWriteHeadHeaders(res, resolvedHeaders);
      }

      return res;
    };

    res.write = (...args: any[]) => {
      start();
      return gzip
        ? gzip.write(...(args as Parameters<typeof write>))
        : write.apply(res, args as Parameters<typeof write>);
    };

    res.end = (...args: any[]) => {
      start();
      if (gzip) {
        (gzip.end as (...args: any[]) => void)(...args);
        return res;
      }

      return end.apply(res, args as Parameters<typeof end>);
    };

    res.on = (type, listener) => {
      if (started) {
        if (!gzip || type !== 'drain') {
          on(type, listener);
        } else {
          gzip.on(type, listener);
        }
      } else {
        // store listeners until start
        listeners.push([type, listener]);
      }
      return res;
    };

    next();
  };
}
