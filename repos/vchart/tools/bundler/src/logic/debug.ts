import createDebug from 'debug';

const debug = createDebug('Bundler');

export const DebugConfig = debug.extend('config');
export const DebugCompile = debug.extend('compile');
