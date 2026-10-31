import type { Stats as FSStats, ReadStream } from 'node:fs';
import type { IncomingHttpHeaders, OutgoingHttpHeaders, ServerResponse } from 'node:http';
import { lookup } from 'mrmime';
import onFinished from 'on-finished';
import type { Range, Result as RangeResult, Ranges } from 'range-parser';
import type { InternalContext, RequestHandler, Rspack } from '../../types';
import { HttpCode } from '../helper';
import { getFileFromUrl } from './getFileFromUrl';
import { parseTokenList } from './parseTokenList';

function getEtag(stat: FSStats): string {
  const mtime = stat.mtime.getTime().toString(16);
  const size = stat.size.toString(16);
  return `W/"${size}-${mtime}"`;
}

// Large dev bundles pay noticeable overhead when streamed in many small chunks.
// Use a larger read buffer while still keeping responses streamed with backpressure.
const READ_STREAM_HIGH_WATER_MARK = 512 * 1024;

function createReadStream(
  filename: string,
  outputFileSystem: Rspack.OutputFileSystem,
  start: number,
  end: number,
): ReadStream {
  const createOutputReadStream = outputFileSystem.createReadStream as unknown as (
    p: string,
    opts: { start: number; end: number; highWaterMark: number },
  ) => ReadStream;

  return createOutputReadStream(filename, {
    start,
    end,
    highWaterMark: READ_STREAM_HIGH_WATER_MARK,
  });
}

function getContentType(str: string): false | string {
  let mime = lookup(str);
  if (!mime) {
    return false;
  }
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/manifest+json'
  ) {
    mime += '; charset=utf-8';
  }
  return mime;
}

const BYTES_RANGE_REGEXP = /^ *bytes/i;

function getValueContentRangeHeader(type: string, size: number, range?: Range): string {
  return `${type} ${range ? `${range.start}-${range.end}` : '*'}:${size}`.replace(':', '/');
}

function parseHttpDate(date: string): number {
  const timestamp = date && Date.parse(date);
  return typeof timestamp === 'number' ? timestamp : Number.NaN;
}

const CACHE_CONTROL_NO_CACHE_REGEXP = /(?:^|,)\s*?no-cache\s*?(?:,|$)/;

function getRequestHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value.join(',') : value;
}

function isConditionalGET(headers: IncomingHttpHeaders): boolean {
  return Boolean(
    headers['if-match'] ||
    headers['if-unmodified-since'] ||
    headers['if-none-match'] ||
    headers['if-modified-since'],
  );
}

function isPreconditionFailure(headers: IncomingHttpHeaders, res: ServerResponse): boolean {
  const ifMatch = getRequestHeader(headers, 'if-match');

  if (ifMatch) {
    const etag = res.getHeader('ETag');

    return (
      !etag ||
      (ifMatch !== '*' &&
        parseTokenList(ifMatch).every(
          (match: string) => match !== etag && match !== `W/${etag}` && `W/${match}` !== etag,
        ))
    );
  }

  const ifUnmodifiedSince = getRequestHeader(headers, 'if-unmodified-since');
  if (ifUnmodifiedSince) {
    const unmodifiedSince = parseHttpDate(ifUnmodifiedSince);
    if (!Number.isNaN(unmodifiedSince)) {
      const lastModified = parseHttpDate(String(res.getHeader('Last-Modified')));
      return Number.isNaN(lastModified) || lastModified > unmodifiedSince;
    }
  }

  return false;
}

function isCachable(statusCode: number): boolean {
  return (statusCode >= 200 && statusCode < 300) || statusCode === HttpCode.NotModified;
}

function isFresh(headers: IncomingHttpHeaders, resHeaders: OutgoingHttpHeaders): boolean {
  const cacheControl = getRequestHeader(headers, 'cache-control');

  if (cacheControl && CACHE_CONTROL_NO_CACHE_REGEXP.test(cacheControl)) {
    return false;
  }

  const noneMatch = getRequestHeader(headers, 'if-none-match');
  const modifiedSince = getRequestHeader(headers, 'if-modified-since');

  if (!noneMatch && !modifiedSince) {
    return false;
  }

  if (noneMatch && noneMatch !== '*') {
    if (!resHeaders.etag) {
      return false;
    }

    const matches = parseTokenList(noneMatch);
    let etagStale = true;

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      if (
        match === resHeaders.etag ||
        match === `W/${resHeaders.etag}` ||
        `W/${match}` === resHeaders.etag
      ) {
        etagStale = false;
        break;
      }
    }

    if (etagStale) {
      return false;
    }
  }

  if (noneMatch) {
    return true;
  }

  if (modifiedSince) {
    const lastModified = resHeaders['last-modified'];
    const modifiedStale =
      !lastModified || !(parseHttpDate(String(lastModified)) <= parseHttpDate(modifiedSince));

    if (modifiedStale) {
      return false;
    }
  }

  return true;
}

function isRangeFresh(headers: IncomingHttpHeaders, res: ServerResponse): boolean {
  const ifRange = getRequestHeader(headers, 'if-range');

  if (!ifRange) {
    return true;
  }

  if (ifRange.indexOf('"') !== -1) {
    const etag = res.getHeader('ETag') as string | undefined;
    if (!etag) {
      return true;
    }
    // If-Range entity-tags require strong comparison. Weak validators should
    // fall back to the full response instead of serving partial content.
    if (ifRange.startsWith('W/') || etag.startsWith('W/')) {
      return false;
    }
    return ifRange === etag;
  }

  const lastModified = res.getHeader('Last-Modified') as string | undefined;
  if (!lastModified) {
    return true;
  }

  return parseHttpDate(lastModified) <= parseHttpDate(ifRange);
}

function getRangeHeader(headers: IncomingHttpHeaders): string | undefined {
  const range = getRequestHeader(headers, 'range');
  if (range && BYTES_RANGE_REGEXP.test(range)) {
    return range;
  }
}

function getOffsetAndLenFromRange(range: Range): [number, number] {
  const { start, end } = range;
  const len = end - start + 1;
  return [start, len];
}

function calcStartAndEnd(start: number, len: number): [number, number] {
  const end = Math.max(start, start + len - 1);
  return [start, end];
}

function destroyStream(stream: ReadStream, suppress: boolean): void {
  if (typeof stream.destroy === 'function') {
    stream.destroy();
  }

  if (typeof stream.close === 'function') {
    stream.on('open', function onOpenClose(this: ReadStream, fd) {
      if (typeof fd === 'number') {
        this.close();
      }
    });
  }

  if (typeof stream.addListener === 'function' && suppress) {
    stream.removeAllListeners('error');
    stream.addListener('error', () => {});
  }
}

const parseRangeHeaders = async (value: string): Promise<RangeResult | Ranges> => {
  const { default: rangeParser } = await import(
    /* rspackChunkName: "range-parser" */
    'range-parser'
  );
  const [len, rangeHeader] = value.split('|');
  return rangeParser(Number(len), rangeHeader, {
    combine: true,
  });
};

function sendError(res: ServerResponse, code: number): void {
  const errorMessages: Record<number, string> = {
    [HttpCode.BadRequest]: 'Bad Request',
    [HttpCode.Forbidden]: 'Forbidden',
    [HttpCode.NotFound]: 'Not Found',
    [HttpCode.PreconditionFailed]: 'Precondition Failed',
    [HttpCode.RangeNotSatisfiable]: 'Range Not Satisfiable',
    [HttpCode.InternalServerError]: 'Internal Server Error',
  };

  const content = errorMessages[code];
  const message = `${code} ${content}`;
  const document = Buffer.from(
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${message}</title>
  </head>
  <body>
    <h1 style="text-align: center;">${message}</h1>
    <hr>
    <div style="text-align: center;">Rsbuild dev server</div>
  </body>
</html>`,
    'utf-8',
  );

  res.statusCode = code;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const byteLength = Buffer.byteLength(document);
  res.setHeader('Content-Length', byteLength);
  res.end(document);
}

export function createAssetsMiddleware(
  context: InternalContext,
  ready: (callback: () => void) => void,
  outputFileSystem: Rspack.OutputFileSystem,
): RequestHandler {
  const { logger } = context;

  return async function assetsMiddleware(req, res, next) {
    async function goNext() {
      return new Promise<void>((resolve) => {
        ready(() => {
          next();
          resolve();
        });
      });
    }

    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
      await goNext();
      return;
    }

    async function processRequest() {
      if (!req.url) {
        await goNext();
        return;
      }

      const resolved = await getFileFromUrl(req.url, outputFileSystem, context);

      if (!resolved) {
        await goNext();
        return;
      }

      if ('errorCode' in resolved) {
        if (resolved.errorCode === HttpCode.Forbidden) {
          logger.error(`[rsbuild:middleware] Malicious path "${req.url}".`);
        } else if (resolved.errorCode === HttpCode.BadRequest) {
          logger.error(`[rsbuild:middleware] Invalid pathname "${req.url}".`);
        }
        sendError(res, resolved.errorCode);
        return;
      }

      const { fsStats, filename } = resolved;
      const { size } = fsStats;
      let len = size;
      let offset = 0;

      if (!res.getHeader('Content-Type')) {
        const contentType = getContentType(filename);
        if (contentType) {
          res.setHeader('Content-Type', contentType);
        }
      }

      if (!res.getHeader('Accept-Ranges')) {
        res.setHeader('Accept-Ranges', 'bytes');
      }

      const rangeHeader = getRangeHeader(req.headers);

      if (!res.getHeader('ETag')) {
        if (fsStats) {
          const hash = getEtag(fsStats);
          res.setHeader('ETag', hash);
        }
      }

      if (isConditionalGET(req.headers)) {
        if (isPreconditionFailure(req.headers, res)) {
          sendError(res, HttpCode.PreconditionFailed);
          return;
        }

        if (res.statusCode === HttpCode.NotFound) {
          res.statusCode = HttpCode.Ok;
        }

        if (
          isCachable(res.statusCode) &&
          isFresh(req.headers, {
            etag: res.getHeader('ETag') as string | undefined,
            'last-modified': res.getHeader('Last-Modified') as string | undefined,
          })
        ) {
          res.statusCode = HttpCode.NotModified;

          res.removeHeader('Content-Encoding');
          res.removeHeader('Content-Language');
          res.removeHeader('Content-Length');
          res.removeHeader('Content-Range');
          res.removeHeader('Content-Type');
          res.end();
          return;
        }
      }

      if (rangeHeader) {
        let parsedRanges: Ranges | RangeResult | [] = await parseRangeHeaders(
          `${size}|${rangeHeader}`,
        );

        if (!isRangeFresh(req.headers, res)) {
          parsedRanges = [];
        }

        if (parsedRanges === -1) {
          logger.error("[rsbuild:middleware] Unsatisfiable range for 'Range' header.");

          res.setHeader('Content-Range', getValueContentRangeHeader('bytes', size));

          sendError(res, HttpCode.RangeNotSatisfiable);
          return;
        }
        if (parsedRanges === -2) {
          logger.error(
            "[rsbuild:middleware] A malformed 'Range' header was provided. A regular response will be sent for this request.",
          );
        } else if (parsedRanges.length > 1) {
          logger.error(
            "[rsbuild:middleware] A 'Range' header with multiple ranges was provided. Multiple ranges are not supported, so a regular response will be sent for this request.",
          );
        }

        if (parsedRanges !== -2 && parsedRanges.length === 1) {
          res.statusCode = 206;
          res.setHeader(
            'Content-Range',
            getValueContentRangeHeader('bytes', size, parsedRanges[0]),
          );

          [offset, len] = getOffsetAndLenFromRange(parsedRanges[0]);
        }
      }

      let readStream: ReadStream;

      const [start, end] = calcStartAndEnd(offset, len);

      try {
        readStream = createReadStream(filename, outputFileSystem, start, end);
      } catch {
        await goNext();
        return;
      }

      res.setHeader('Content-Length', len);

      if (req.method === 'HEAD') {
        if (res.statusCode === HttpCode.NotFound) {
          res.statusCode = HttpCode.Ok;
        }
        res.end();
        return;
      }

      const cleanup = () => {
        destroyStream(readStream, true);
      };

      readStream.on('error', (error: NodeJS.ErrnoException) => {
        cleanup();
        // rslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
        switch (error.code) {
          case 'ENAMETOOLONG':
          case 'ENOENT':
          case 'ENOTDIR':
            sendError(res, HttpCode.NotFound);
            break;
          default:
            sendError(res, HttpCode.InternalServerError);
            break;
        }
      });

      readStream.pipe(res);

      onFinished(res, cleanup);
    }

    ready(processRequest);
  };
}
