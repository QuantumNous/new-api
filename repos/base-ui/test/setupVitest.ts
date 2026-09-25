import { beforeAll, vi } from 'vitest';
import setupVitest from '@mui/internal-test-utils/setupVitest';
// eslint-disable-next-line import/no-relative-packages
import '../packages/react/test/addVitestMatchers';
import '@testing-library/jest-dom/vitest';
import { reset as resetBuiltError } from '@base-ui/utils/error';

declare global {
  // eslint-disable-next-line vars-on-top
  var BASE_UI_ANIMATIONS_DISABLED: boolean;
}

let resetSourceError = () => {};

setupVitest();

beforeAll(async () => {
  // In compiler tests with workspace aliases disabled, the source module and package entry
  // can be loaded as separate instances, so reset the source copy too.
  // eslint-disable-next-line import/no-relative-packages
  ({ reset: resetSourceError } = await import('../packages/utils/src/error'));
});

afterEach(() => {
  vi.resetAllMocks();
  resetBuiltError();
  resetSourceError();
});

globalThis.BASE_UI_ANIMATIONS_DISABLED = true;

if (typeof window !== 'undefined' && window?.navigator?.userAgent?.includes('jsdom')) {
  globalThis.requestAnimationFrame = (cb) => {
    setTimeout(() => cb(0), 0);
    return 0;
  };
}
