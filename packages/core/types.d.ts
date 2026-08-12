/// <reference types="@rspack/core/module" />

/**
 * This is a placeholder for extending the type options.
 * You can augment this interface to enable stricter type checking.
 * @example
 * ```ts
 * interface RsbuildTypeOptions {
 *   // This will enable strict type checking for `import.meta.env`.
 *   strictImportMetaEnv: true;
 * }
 * ```
 */
// rslint-disable-next-line @typescript-eslint/no-empty-object-type
interface RsbuildTypeOptions {}

/**
 * import.meta
 */
type ImportMetaEnvFallbackKey = 'strictImportMetaEnv' extends keyof RsbuildTypeOptions
  ? never
  : string;

interface ImportMetaEnv extends Record<ImportMetaEnvFallbackKey, any> {
  /**
   * The value of the `mode` configuration.
   * @example
   * if (import.meta.env.MODE === 'development') {
   *   console.log('development mode');
   * }
   */
  MODE: 'development' | 'production' | 'none';
  /**
   * If `mode` is `'development'`, the value is `true`; otherwise, it is `false`.
   * @example
   * if (import.meta.env.DEV) {
   *   console.log('development mode');
   * }
   */
  DEV: boolean;
  /**
   * If `mode` is `'production'`, the value is `true`; otherwise, it is `false`.
   * @example
   * if (import.meta.env.PROD) {
   *   console.log('production mode');
   * }
   */
  PROD: boolean;
  /**
   * Whether the current build is for the server (SSR).
   * If `output.target` is `'node'`, the value is `true`; otherwise, it is `false`.
   * @example
   * if (import.meta.env.SSR) {
   *   console.log('SSR build');
   * }
   */
  SSR: boolean;
  /**
   * The value of the `server.base` configuration.
   * @example
   * const image = new Image();
   * // Equivalent to "/foo/favicon.ico"
   * image.src = `${import.meta.env.BASE_URL}/favicon.ico`;
   */
  BASE_URL: string;
  /**
   * The URL prefix of static assets
   * - In development, it is equivalent to the value set by `dev.assetPrefix`.
   * - In production, it is equivalent to the value set by `output.assetPrefix`.
   * - Rsbuild will automatically remove the trailing slash from `assetPrefix`
   * to make string concatenation easier.
   * @example
   * const image = new Image();
   * image.src = `${import.meta.env.ASSET_PREFIX}/favicon.ico`;
   */
  ASSET_PREFIX: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace Rspack {
  interface Hot {
    on: <Data = any>(event: string, cb: (data: Data) => void) => void;
  }
}

/**
 * Image assets
 */
declare module '*.bmp' {
  const src: string;
  export default src;
}
declare module '*.gif' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.pjpeg' {
  const src: string;
  export default src;
}
declare module '*.pjp' {
  const src: string;
  export default src;
}
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.ico' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.apng' {
  const src: string;
  export default src;
}
declare module '*.avif' {
  const src: string;
  export default src;
}
declare module '*.tif' {
  const src: string;
  export default src;
}
declare module '*.tiff' {
  const src: string;
  export default src;
}
declare module '*.jfif' {
  const src: string;
  export default src;
}
declare module '*.cur' {
  const src: string;
  export default src;
}

/**
 * Font assets
 */
declare module '*.woff' {
  const src: string;
  export default src;
}
declare module '*.woff2' {
  const src: string;
  export default src;
}
declare module '*.eot' {
  const src: string;
  export default src;
}
declare module '*.ttf' {
  const src: string;
  export default src;
}
declare module '*.otf' {
  const src: string;
  export default src;
}
declare module '*.ttc' {
  const src: string;
  export default src;
}

/**
 * Media assets
 */
declare module '*.mp4' {
  const src: string;
  export default src;
}
declare module '*.webm' {
  const src: string;
  export default src;
}
declare module '*.ogg' {
  const src: string;
  export default src;
}
declare module '*.mp3' {
  const src: string;
  export default src;
}
declare module '*.wav' {
  const src: string;
  export default src;
}
declare module '*.flac' {
  const src: string;
  export default src;
}
declare module '*.aac' {
  const src: string;
  export default src;
}
declare module '*.mov' {
  const src: string;
  export default src;
}
declare module '*.m4a' {
  const src: string;
  export default src;
}
declare module '*.opus' {
  const src: string;
  export default src;
}

/**
 * @requires [@rsbuild/plugin-yaml](https://npmjs.com/package/@rsbuild/plugin-yaml)
 */
declare module '*.yaml' {
  const content: Record<string, any>;
  export default content;
}
/**
 * @requires [@rsbuild/plugin-yaml](https://npmjs.com/package/@rsbuild/plugin-yaml)
 */
declare module '*.yml' {
  const content: Record<string, any>;
  export default content;
}
/**
 * @requires [@rsbuild/plugin-toml](https://npmjs.com/package/@rsbuild/plugin-toml)
 */
declare module '*.toml' {
  const content: Record<string, any>;
  export default content;
}

/**
 * Imports the file as a URL string.
 * @note Only works for static assets and CSS files by default.
 * @example
 * import logoUrl from './logo.png?url'
 * console.log(logoUrl) // 'http://example.com/logo.123456.png'
 *
 * import cssUrl from './style.css?url'
 * console.log(cssUrl) // 'http://example.com/style.123456.css'
 */
declare module '*?url' {
  const content: string;
  export default content;
}

/**
 * Imports the file as a Web Worker constructor.
 * @example
 * import MyWorker from './worker.ts?worker';
 * const worker = new MyWorker();
 */
declare module '*?worker' {
  const WorkerConstructor: {
    new (options?: { name?: string }): Worker;
  };
  export default WorkerConstructor;
}

/**
 * Imports the file as an inline Web Worker constructor.
 * @example
 * import MyWorker from './worker.ts?worker&inline';
 * const worker = new MyWorker();
 */
declare module '*?worker&inline' {
  const WorkerConstructor: {
    new (options?: { name?: string }): Worker;
  };
  export default WorkerConstructor;
}

declare module '*?inline&worker' {
  const WorkerConstructor: {
    new (options?: { name?: string }): Worker;
  };
  export default WorkerConstructor;
}

/**
 * Imports the file content as a base64 encoded string.
 * @note Only works for static assets and CSS files by default.
 * @example
 * import logo from './logo.svg?inline'
 * console.log(logo) // 'data:image/svg+xml;base64,...'
 *
 * import inlineCss from './style.css?inline';
 * console.log(inlineCss); // Compiled CSS content
 */
declare module '*?inline' {
  const content: string;
  export default content;
}

/**
 * Imports the raw content of the file as a string.
 * @note Only works for static assets, CSS files, and scripts
 * (JS, TS, JSX, TSX) by default.
 * @example
 * import raw from './logo.svg?raw'
 * console.log(raw) // '<svg viewBox="0 0 24 24">...</svg>'
 *
 * import rawJs from './script.js?raw'
 * console.log(rawJs) // 'console.log("Hello world");'
 *
 * import rawCss from './style.css?raw'
 * console.log(rawCss) // 'body { background: red; }'
 */
declare module '*?raw' {
  const content: string;
  export default content;
}

/**
 * CSS Modules
 */
type CSSModuleClasses = Readonly<Record<string, string>>;
declare module '*.module.css' {
  const classes: CSSModuleClasses;
  export default classes;
}
/**
 * @requires [@rsbuild/plugin-sass](https://npmjs.com/package/@rsbuild/plugin-sass)
 */
declare module '*.module.scss' {
  const classes: CSSModuleClasses;
  export default classes;
}
/**
 * @requires [@rsbuild/plugin-sass](https://npmjs.com/package/@rsbuild/plugin-sass)
 */
declare module '*.module.sass' {
  const classes: CSSModuleClasses;
  export default classes;
}
/**
 * @requires [@rsbuild/plugin-less](https://npmjs.com/package/@rsbuild/plugin-less)
 */
declare module '*.module.less' {
  const classes: CSSModuleClasses;
  export default classes;
}
/**
 * @requires [@rsbuild/plugin-stylus](https://npmjs.com/package/@rsbuild/plugin-stylus)
 */
declare module '*.module.styl' {
  const classes: CSSModuleClasses;
  export default classes;
}
/**
 * @requires [@rsbuild/plugin-stylus](https://npmjs.com/package/@rsbuild/plugin-stylus)
 */
declare module '*.module.stylus' {
  const classes: CSSModuleClasses;
  export default classes;
}

/**
 * CSS
 */
declare module '*.css' {}
/**
 * @requires [@rsbuild/plugin-sass](https://npmjs.com/package/@rsbuild/plugin-sass)
 */
declare module '*.scss' {}
/**
 * @requires [@rsbuild/plugin-sass](https://npmjs.com/package/@rsbuild/plugin-sass)
 */
declare module '*.sass' {}
/**
 * @requires [@rsbuild/plugin-less](https://npmjs.com/package/@rsbuild/plugin-less)
 */
declare module '*.less' {}
/**
 * @requires [@rsbuild/plugin-stylus](https://npmjs.com/package/@rsbuild/plugin-stylus)
 */
declare module '*.styl' {}
/**
 * @requires [@rsbuild/plugin-stylus](https://npmjs.com/package/@rsbuild/plugin-stylus)
 */
declare module '*.stylus' {}
