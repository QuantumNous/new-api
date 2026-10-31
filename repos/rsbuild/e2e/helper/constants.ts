import { join } from 'node:path';

export const BUILD_END_LOG = 'built in';
export const HMR_CONNECTED_LOG = '[rsbuild] WebSocket connected.';
export const MODULE_BUILD_FAILED_LOG = 'Module build failed';

export const OVERLAY_ID = 'rsbuild-error-overlay';
export const OVERLAY_TITLE_BUILD_FAILED = 'Build failed';

export const RSBUILD_BIN_PATH = join(
  import.meta.dirname,
  '../node_modules/@rsbuild/core/bin/rsbuild.js',
);

export const CREATE_RSBUILD_BIN_PATH = join(
  import.meta.dirname,
  '../node_modules/create-rsbuild/bin.js',
);

export const NETWORK_LOG_REGEX = /➜\s{2}Network:\s{2}http:\/\/\d{1,3}(?:\.\d{1,3}){3}:\d+/;
