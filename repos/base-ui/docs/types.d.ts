/// <reference types="gtag.js" />

declare namespace NodeJS {
  interface ProcessEnv {
    BASE_URL: string;
    LIB_VERSION: string;
    SOURCE_CODE_REPO: string;
  }
}

declare module 'gtag.js';

declare module '*.mdx' {
  const MDXComponent: (props) => JSX.Element;
  export default MDXComponent;
}

declare module '*.css';
