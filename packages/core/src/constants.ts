import { join } from 'node:path';

export const isDeno: boolean = typeof Deno !== 'undefined';
export const isWindows: boolean = process.platform === 'win32';

// Paths
export const ROOT_DIST_DIR = 'dist';
export const HTML_DIST_DIR = './';
export const FAVICON_DIST_DIR = './';
export const JS_DIST_DIR = 'static/js';
export const CSS_DIST_DIR = 'static/css';
export const SVG_DIST_DIR = 'static/svg';
export const FONT_DIST_DIR = 'static/font';
export const WASM_DIST_DIR = 'static/wasm';
export const IMAGE_DIST_DIR = 'static/image';
export const MEDIA_DIST_DIR = 'static/media';
export const ASSETS_DIST_DIR = 'static/assets';

const dirname = import.meta.dirname;
// loaders will be emitted to the same folder of the main bundle
export const LOADER_PATH: string = dirname;
export const STATIC_PATH: string = join(dirname, '../static');
export const CLIENT_PATH: string = join(dirname, 'client');
export const COMPILED_PATH: string = join(dirname, '../compiled');
export const TS_CONFIG_FILE = 'tsconfig.json';
export const HMR_SOCKET_PATH = '/rsbuild-hmr';
export const RSBUILD_OUTPUTS_PATH = '.rsbuild';

export const LOCALHOST = 'localhost';
export const ALL_INTERFACES_IPV4 = '0.0.0.0';

// Defaults
export const DEFAULT_PORT = 3000;
export const DEFAULT_DATA_URL_SIZE = 4096;
export const DEFAULT_MOUNT_ID = 'root';
export const DEFAULT_ASSET_PREFIX = '/';
export const DEFAULT_STACK_TRACE = 'summary';
// Defaults to "baseline widely available on 2025-05-01"
// https://browsersl.ist/#q=baseline+widely+available+on+2025-05-01
export const DEFAULT_WEB_BROWSERSLIST: string[] = [
  'chrome >= 107',
  'edge >= 107',
  'firefox >= 104',
  'safari >= 16',
];
export const DEFAULT_BROWSERSLIST: Record<string, string[]> = {
  web: DEFAULT_WEB_BROWSERSLIST,
  'web-worker': DEFAULT_WEB_BROWSERSLIST,
  // Node.js 18 reached its EOL on April 30, 2025
  node: ['node >= 20'],
};

// RegExp
export const JS_REGEX: RegExp = /\.(?:js|mjs|cjs|jsx)$/;
export const SCRIPT_REGEX: RegExp = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/;
export const CSS_REGEX: RegExp = /\.css$/;
/**
 * Regular expression to match the 'raw' query parameter.
 * Matches patterns like: `?raw`, `?raw&other=value`, `?other=value&raw`, `?raw=value`
 */
export const RAW_QUERY_REGEX: RegExp = /[?&]raw(?:&|=|$)/;
/**
 * Regular expression to match the 'inline' query parameter.
 * Matches patterns like: `?inline`, `?inline&other=value`, `?other=value&inline`, `?inline=value`
 */
export const INLINE_QUERY_REGEX: RegExp = /[?&]inline(?:&|=|$)/;
/**
 * Regular expression to match the 'url' query parameter.
 * Matches patterns like: `?url`, `?url&other=value`, `?other=value&url`, `?url=value`
 */
export const URL_QUERY_REGEX: RegExp = /[?&]url(?:&|=|$)/;
/**
 * Regular expression to match the 'worker' query parameter.
 * Matches patterns like: `?worker`, `?worker&inline`, `?inline&worker`, `?worker=value`
 */
export const WORKER_QUERY_REGEX: RegExp = /[?&]worker(?:&|=|$)/;
export const NODE_MODULES_REGEX: RegExp = /[\\/]node_modules[\\/]/;

// Plugins
export const PLUGIN_SWC_NAME = 'rsbuild:swc';
export const PLUGIN_CSS_NAME = 'rsbuild:css';

// Extensions
export const FONT_EXTENSIONS: string[] = ['woff', 'woff2', 'eot', 'ttf', 'otf', 'ttc'];
export const IMAGE_EXTENSIONS: string[] = [
  'png',
  'jpg',
  'jpeg',
  'pjpeg',
  'pjp',
  'gif',
  'bmp',
  'webp',
  'ico',
  'apng',
  'avif',
  'tif',
  'tiff',
  'jfif',
  'cur',
];
export const VIDEO_EXTENSIONS: string[] = ['mp4', 'webm', 'ogg', 'mov'];
export const AUDIO_EXTENSIONS: string[] = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'opus'];

export const LAZY_COMPILATION_IDENTIFIER = 'lazy-compilation-proxy';

export const BROWSER_LOG_PREFIX = '[browser]';
