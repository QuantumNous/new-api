import { describe, it, expect, beforeEach, vitest } from 'vitest';
import BackendConnector from '../../../src/BackendConnector.js';
import Interpolator from '../../../src/Interpolator.js';
import ResourceStore from '../../../src/ResourceStore.js';
import BackendMock from './backendMock.js';
import BackendMockPromise from './backendMockPromise.js';
import BackendMockSync from './backendMockSync.js';

describe('BackendConnector with different signatures', () => {
  describe('BackendConnector with callback signature', () => {
    let connector;

    beforeEach(() => {
      connector = new BackendConnector(
        new BackendMock(),
        new ResourceStore(),
        {
          interpolator: new Interpolator(),
        },
        {},
      );
    });

    describe('#load', () => {
      it('should work as usual', () => {
        expect.assertions(2);

        connector.load(['en'], ['normal'], (err) => {
          expect(err).toEqual(undefined);
          expect(connector.store.getResourceBundle('en', 'normal')).toEqual({
            status: 'ok',
            language: 'en',
            namespace: 'normal',
          });
        });
      });
    });

    describe('#saveMissing', () => {
      it('should work as usual', () => {
        expect.assertions(2);

        connector.saveMissing(
          ['en'],
          'normal',
          'missing.key',
          'some fallback',
          false,
          { tDescription: 'some descr' },
          (err) => {
            expect(err).to.be.oneOf([null, undefined]);
            expect(connector.backend.created).toEqual({
              en: {
                normal: {
                  'missing.key': {
                    fallbackValue: 'some fallback',
                    options: {
                      tDescription: 'some descr',
                      isUpdate: false,
                    },
                  },
                },
              },
            });
          },
        );
      });
    });
  });

  describe('BackendConnector with promise signature', () => {
    /** @type {BackendConnector} */
    let connector;

    beforeEach(() => {
      connector = new BackendConnector(
        new BackendMockPromise(),
        new ResourceStore(),
        {
          interpolator: new Interpolator(),
        },
        {},
      );
    });

    describe('#load', () => {
      it('should work as usual', async () => {
        const callback = vitest.fn();

        connector.load(['en'], ['namespace2'], callback);

        await vitest.waitFor(() => expect(callback).toHaveBeenCalled());

        expect(callback).toHaveBeenCalledWith();
        expect(connector.store.getResourceBundle('en', 'namespace2')).toEqual({
          status: 'ok',
          language: 'en',
          namespace: 'namespace2',
        });
      });
    });

    describe('#saveMissing', () => {
      it('should work as usual', async () => {
        const callback = vitest.fn();

        connector.saveMissing(
          ['en'],
          'namespace2',
          'missing.key',
          'some fallback',
          false,
          { tDescription: 'some descr' },
          callback,
        );

        await vitest.waitFor(() => expect(callback).toHaveBeenCalled());

        expect(callback).toHaveBeenCalledWith(null, undefined);
        expect(connector.backend.created).toEqual({
          en: {
            namespace2: {
              'missing.key': {
                fallbackValue: 'some fallback',
                options: {
                  tDescription: 'some descr',
                  isUpdate: false,
                },
              },
            },
          },
        });
      });
    });
  });

  describe('BackendConnector with sync signature', () => {
    /** @type {BackendConnector} */
    let connector;

    beforeEach(() => {
      connector = new BackendConnector(
        new BackendMockSync(),
        new ResourceStore(),
        {
          interpolator: new Interpolator(),
        },
        {},
      );
    });

    describe('#load', () => {
      it('should work as usual', async () => {
        const callback = vitest.fn();

        connector.load(['en'], ['namespace3'], callback);

        await vitest.waitFor(() => expect(callback).toHaveBeenCalled());

        expect(callback).toHaveBeenCalledWith();
        expect(connector.store.getResourceBundle('en', 'namespace3')).toEqual({
          status: 'ok',
          language: 'en',
          namespace: 'namespace3',
        });
      });
    });

    describe('#saveMissing', () => {
      it('should work as usual', async () => {
        const callback = vitest.fn();

        connector.saveMissing(
          ['en'],
          'namespace3',
          'missing.key',
          'some fallback',
          false,
          { tDescription: 'some descr' },
          callback,
        );

        await vitest.waitFor(() => expect(callback).toHaveBeenCalled());

        expect(callback).toHaveBeenCalledWith(null, undefined);
        expect(connector.backend.created).toEqual({
          en: {
            namespace3: {
              'missing.key': {
                fallbackValue: 'some fallback',
                options: {
                  tDescription: 'some descr',
                  isUpdate: false,
                },
              },
            },
          },
        });
      });
    });
  });
});
