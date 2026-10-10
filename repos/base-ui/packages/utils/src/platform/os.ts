import { lowerUserAgent, lowerPlatform, maxTouchPoints } from './shared';

// iPadOS 13+ reports `MacIntel` for `navigator.platform`; disambiguated via
// `maxTouchPoints` so iPad is classified as iOS, not macOS.
// https://github.com/mui/base-ui/issues/1309
/** iPhone, iPad (including iPadOS 13+ reporting as macOS), iPod. */
export const ios =
  /^i(os$|p)/.test(lowerPlatform) || (lowerPlatform === 'macintel' && maxTouchPoints > 1);

/** Android phones, tablets, and embedded Android browsers. */
const ANDROID_STRING = 'android';
export const android = lowerPlatform === ANDROID_STRING || lowerUserAgent.includes(ANDROID_STRING);

/** macOS desktop. Excludes iPadOS, which reports as `MacIntel`. */
export const mac = !ios && lowerPlatform.startsWith('mac');

/** Windows desktop. */
export const windows = lowerPlatform.startsWith('win');

/** Linux desktop (including Chrome OS). */
export const linux = !android && /^(linux|chrome os)/.test(lowerPlatform);

/** Any Apple OS (`mac || ios`). */
export const apple = mac || ios;
