/// <reference types="node" />
import type * as http from 'http';
/**
 * Fix proxied body if bodyParser is involved.
 */
export declare function fixRequestBody(proxyReq: http.ClientRequest, req: http.IncomingMessage): void;
