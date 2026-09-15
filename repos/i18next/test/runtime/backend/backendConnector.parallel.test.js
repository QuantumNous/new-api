import { describe, it, expect, beforeEach, vitest } from 'vitest';
import BackendConnector from '../../../src/BackendConnector.js';
import Interpolator from '../../../src/Interpolator.js';
import ResourceStore from '../../../src/ResourceStore.js';
import BackendMock from './backendMockSleepy.js';

describe('BackendConnector with sleepy backend', () => {
  describe('#load', () => {
    describe('10 max parallel', () => {
      let connector;

      beforeEach(() => {
        connector = new BackendConnector(
          new BackendMock(),
          new ResourceStore(),
          {
            interpolator: new Interpolator(),
          },
          {
            maxParallelReads: 10,
            backend: { loadPath: 'http://localhost:9876/locales/{{lng}}/{{ns}}.json' },
          },
        );
      });

      it('backend should not be called 20 times before any have returned', async () => {
        const namespaces = [];
        for (let i = 0; i < 20; i++) {
          namespaces.push(`namespace${i}`);
        }

        const callback = vitest.fn();
        connector.load(['en'], namespaces, callback);

        await vitest.waitFor(() => expect(callback).toHaveBeenCalled());

        expect(connector.store.getResourceBundle('en', 'namespace1')).toEqual({
          status: 'ok',
        });
        expect(connector.backend.parallelCallsHighWaterMark).toBeLessThan(20);
        expect(connector.backend.parallelCallsHighWaterMark).toEqual(10);
      });
    });

    describe('100 max parallel', () => {
      /** @type {BackendConnector} */
      let connector;

      beforeEach(() => {
        connector = new BackendConnector(
          new BackendMock(),
          new ResourceStore(),
          {
            interpolator: new Interpolator(),
          },
          {
            maxParallelReads: 100,
            backend: { loadPath: 'http://localhost:9876/locales/{{lng}}/{{ns}}.json' },
          },
        );
      });

      it('backend should be called 20 times before any have returned', async () => {
        const namespaces = [];
        for (let i = 0; i < 20; i++) {
          namespaces.push(`namespace${i}`);
        }

        const callback = vitest.fn();

        connector.load(['en'], namespaces, callback);

        await vitest.waitFor(() =>
          expect(connector.backend.parallelCallsHighWaterMark).toEqual(20),
        );
        await vitest.waitFor(() =>
          expect(connector.store.getResourceBundle('en', 'namespace1')).toEqual({
            status: 'ok',
          }),
        );
      });

      it('backend should get more calls 2nd time around', async () => {
        let namespaces = [];
        for (let i = 0; i < 20; i++) {
          namespaces.push(`namespace${i}`);
        }

        const callback = vitest.fn();

        connector.load(['en'], namespaces, callback);
        await vitest.waitFor(() =>
          expect(connector.backend.parallelCallsHighWaterMark).toEqual(20),
        );
        await vitest.waitFor(() =>
          expect(
            expect(connector.store.getResourceBundle('en', 'namespace1')).toEqual({
              status: 'ok',
            }),
          ),
        );

        expect(callback).toHaveBeenCalledWith();

        callback.mockClear();

        // Run again with higher call count - different namespace names
        namespaces = [];
        for (let i = 0; i < 30; i++) {
          namespaces.push(`namespace-run2${i}`);
        }

        connector.load(['en'], namespaces, callback);
        await vitest.waitFor(() =>
          expect(connector.backend.parallelCallsHighWaterMark).toEqual(30),
        );
        await vitest.waitFor(() =>
          expect(
            expect(connector.store.getResourceBundle('en', 'namespace-run20')).toEqual({
              status: 'ok',
            }),
          ),
        );

        expect(callback).toHaveBeenCalled();
      });

      it('reloading already loaded should not increase high watermark', async () => {
        let namespaces = [];
        for (let i = 0; i < 20; i++) {
          namespaces.push(`namespace${i}`);
        }

        const callback = vitest.fn();

        connector.load(['en'], namespaces, callback);

        await vitest.waitFor(() =>
          expect(connector.backend.parallelCallsHighWaterMark).toEqual(20),
        );
        await vitest.waitFor(() =>
          expect(connector.store.getResourceBundle('en', 'namespace1')).toEqual({
            status: 'ok',
          }),
        );

        callback.mockClear();

        // Run again with higher call count - same namespace names
        namespaces = [];
        for (let i = 0; i < 30; i++) {
          namespaces.push(`namespace${i}`);
        }
        connector.load(['en'], namespaces, callback);

        await vitest.waitFor(() =>
          expect(connector.backend.parallelCallsHighWaterMark).toEqual(20),
        );
        await vitest.waitFor(() =>
          expect(connector.store.getResourceBundle('en', 'namespace1')).toEqual({
            status: 'ok',
          }),
        );
      });
    });
  });
});
