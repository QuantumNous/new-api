export declare const log: (msg: string, ...args: any[]) => import("@visactor/vutils").ILogger;
export declare const warn: (msg: string, detail?: any) => import("@visactor/vutils").ILogger;
export declare const error: (msg: string, detail?: any, err?: Error) => void;
export declare const config: IConfig;
export interface IConfig {
    silent: boolean;
    errorHandler?: (msg: string, detail?: any) => void;
    warnHandler?: (msg: string, detail?: any) => void;
}
