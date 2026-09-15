import { lowerUserAgent } from './shared';

/** Running in jsdom or HappyDOM (used by unit tests). */
export const jsdom = /jsdom|happydom/.test(lowerUserAgent);
