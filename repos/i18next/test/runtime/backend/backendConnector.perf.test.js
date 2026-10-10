import { describe, it, expect, beforeAll } from 'vitest';
import BackendConnector from '../../../src/BackendConnector.js';
import Interpolator from '../../../src/Interpolator.js';
import ResourceStore from '../../../src/ResourceStore.js';
import BackendMock from './backendMock.js';

describe('BackendConnector performance test', () => {
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
    it('should load 10,000 items in under the 2 second timeout', () => {
      expect.assertions(2);

      const namespaces = [];
      for (let i = 0; i < 10000; i++) {
        namespaces.push(`namespace${i}`);
      }
      connector.load(['en'], namespaces, (err) => {
        expect(err).toBeFalsy();
        expect(connector.store.getResourceBundle('en', 'namespace1')).toEqual({
          status: 'nok',
          retries: 0,
        });
      });
    });
  });
});
