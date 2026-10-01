import { describe, it, expect, vitest, beforeAll } from 'vitest';
import BackendConnector from '../../../src/BackendConnector.js';
import Interpolator from '../../../src/Interpolator.js';
import ResourceStore from '../../../src/ResourceStore.js';
import BackendMock from '../../runtime/backend/backendMock.js';

/** Those are just skipped for ci/cd, but occasionally we run them locally */
describe('BackendConnector performance (retry) test', () => {
  /** @type {BackendConnector} */
  let connector;

  beforeAll(() => {
    connector = new BackendConnector(
      new BackendMock(),
      new ResourceStore(),
      {
        interpolator: new Interpolator(),
      },
      {
        backend: { loadPath: 'http://localhost:9876/locales/{{lng}}/{{ns}}.json' },
      },
    );
  });

  describe('#load', () => {
    it(
      'should load retry (failed) items mixed with concurrent longer items in under the 12 seconds timeout',
      { timeout: 12000 },
      async () => {
        const namespaces = [];
        for (let i = 0; i < 20; i++) {
          namespaces.push(`concurrentlyLonger${i}`);
        }
        for (let i = 0; i < 3; i++) {
          namespaces.push(`fail${i}`);
        }
        for (let i = 0; i < 20; i++) {
          namespaces.push(`concurrently${i}`);
        }

        const callback = vitest.fn();

        connector.load(['en'], namespaces, callback);

        await vitest.waitFor(() => expect(callback).toHaveBeenCalled(), {
          timeout: 12000,
        });

        expect(callback).toHaveBeenCalledWith([
          'failed loading',
          'failed loading',
          'failed loading',
        ]);
      },
    );
  });
});
