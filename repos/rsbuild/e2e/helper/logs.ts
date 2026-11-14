import {
  type ExtendedLogHelper as BaseExtendedLogHelper,
  type LogHelper as BaseLogHelper,
  proxyConsole as baseProxyConsole,
  type ProxyConsoleOptions,
} from '@rstackjs/test-utils';
import { BUILD_END_LOG } from './constants.ts';

type ExpectBuildEnd = {
  expectBuildEnd: () => Promise<boolean>;
};

export type LogHelper = BaseLogHelper & ExpectBuildEnd;

export type ExtendedLogHelper = BaseExtendedLogHelper & ExpectBuildEnd;

export const proxyConsole = (options?: ProxyConsoleOptions): ExtendedLogHelper => {
  const logHelper = baseProxyConsole(options);

  return {
    ...logHelper,
    expectBuildEnd: async () => logHelper.expectLog(BUILD_END_LOG),
  };
};
