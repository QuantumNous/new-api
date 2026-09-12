import { Logger, isFunction } from '@visactor/vutils';

export const log = (msg: string, ...args: any[]) => {
  if (!config.silent) {
    return Logger.getInstance().info(`[VChart log]: ${msg}`, ...args);
  }
  return null;
};

export const warn = (msg: string, detail?: any) => {
  if (isFunction(config.warnHandler)) {
    config.warnHandler.call(null, msg, detail);
  }
  if (detail) {
    return Logger.getInstance().warn(`[VChart warn]: ${msg}`, detail);
  }
  return Logger.getInstance().warn(`[VChart warn]: ${msg}`);
};

export const error = (msg: string, detail?: any, err?: Error) => {
  if (config.silent) {
    return;
  }
  if (isFunction(config.errorHandler)) {
    config.errorHandler.call(null, msg, detail);
    return;
  }
  throw new Error(msg);
};

export const config = {
  silent: false,
  warnHandler: false,
  errorHandler: false
} as unknown as IConfig;

export interface IConfig {
  /**
   * 是否开启控制台告警
   */
  silent: boolean;
  /**
   * 错误处理
   */
  errorHandler?: (msg: string, detail?: any) => void;
  /**
   * 警告处理
   */
  warnHandler?: (msg: string, detail?: any) => void;
}
