/**
 * Based on definition by DefinitelyTyped:
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/6f529c6c67a447190f86bfbf894d1061e41e07b7/types/http-proxy-middleware/index.d.ts
 */
/// <reference types="node" />
import type * as express from 'express';
import type * as http from 'http';
import type * as httpProxy from 'http-proxy';
import type * as net from 'net';
import type * as url from 'url';
export interface Request extends express.Request {
}
export interface Response extends express.Response {
}
export interface RequestHandler extends express.RequestHandler {
    upgrade?: (req: Request, socket: net.Socket, head: any) => void;
}
export declare type Filter = string | string[] | ((pathname: string, req: Request) => boolean);
export interface Options extends httpProxy.ServerOptions {
    pathRewrite?: {
        [regexp: string]: string;
    } | ((path: string, req: Request) => string) | ((path: string, req: Request) => Promise<string>);
    router?: {
        [hostOrPath: string]: httpProxy.ServerOptions['target'];
    } | ((req: Request) => httpProxy.ServerOptions['target']) | ((req: Request) => Promise<httpProxy.ServerOptions['target']>);
    logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
    logProvider?: LogProviderCallback;
    onError?: OnErrorCallback;
    onProxyRes?: OnProxyResCallback;
    onProxyReq?: OnProxyReqCallback;
    onProxyReqWs?: OnProxyReqWsCallback;
    onOpen?: OnOpenCallback;
    onClose?: OnCloseCallback;
}
interface LogProvider {
    log: Logger;
    debug?: Logger;
    info?: Logger;
    warn?: Logger;
    error?: Logger;
}
declare type Logger = (...args: any[]) => void;
export declare type LogProviderCallback = (provider: LogProvider) => LogProvider;
/**
 * Use types based on the events listeners from http-proxy
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/51504fd999031b7f025220fab279f1b2155cbaff/types/http-proxy/index.d.ts
 */
export declare type OnErrorCallback = (err: Error, req: Request, res: Response, target?: string | Partial<url.Url>) => void;
export declare type OnProxyResCallback = (proxyRes: http.IncomingMessage, req: Request, res: Response) => void;
export declare type OnProxyReqCallback = (proxyReq: http.ClientRequest, req: Request, res: Response, options: httpProxy.ServerOptions) => void;
export declare type OnProxyReqWsCallback = (proxyReq: http.ClientRequest, req: Request, socket: net.Socket, options: httpProxy.ServerOptions, head: any) => void;
export declare type OnCloseCallback = (proxyRes: Response, proxySocket: net.Socket, proxyHead: any) => void;
export declare type OnOpenCallback = (proxySocket: net.Socket) => void;
export {};
