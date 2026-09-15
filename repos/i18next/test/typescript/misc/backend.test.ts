import { describe, it, expectTypeOf } from 'vitest';
import i18next, { InitOptions } from 'i18next';

import HttpBackend, { HttpBackendOptions } from 'i18next-http-backend';
import FsBackend, { FsBackendOptions } from 'i18next-fs-backend';

describe('backend', () => {
  it('works with `i18next-http-backend`', () => {
    expectTypeOf(i18next.use(HttpBackend).init<HttpBackendOptions>)
      .parameter(0)
      .toEqualTypeOf<InitOptions<HttpBackendOptions>>();
  });

  it('works with `i18next-fs-backend`', () => {
    expectTypeOf(i18next.use(FsBackend).init<FsBackendOptions>)
      .parameter(0)
      .toEqualTypeOf<InitOptions<FsBackendOptions>>();
  });
});
