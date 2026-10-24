import { describe, it, expect, beforeAll, vitest } from 'vitest';
import BackendConnector from '../../../src/BackendConnector.js';
import Interpolator from '../../../src/Interpolator.js';
import ResourceStore from '../../../src/ResourceStore.js';
import BackendMock from '../../runtime/backend/backendMock.js';

/** Those are just skipped for ci/cd, but occasionally we run them locally */
describe('BackendConnector load retry', () => {
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
    it('should load data', () => {
      expect.assertions(2);
      return new Promise((resolve) => {
        connector.load(['en'], ['retry2'], (err) => {
          expect(err).toBeFalsy();
          expect(connector.store.getResourceBundle('en', 'retry2')).toEqual({
            status: 'nok',
            retries: 2,
          });
          resolve();
        });
      });
    });
  });
});

describe('BackendConnector load all fail - 1 namespace', () => {
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
    it('should call callback on complete failure', { timeout: 12000 }, () => {
      expect.assertions(2);
      return new Promise((resolve) => {
        connector.load(['en'], ['fail'], (err) => {
          expect(err).toEqual(['failed loading']);
          // expect(connector.store.getResourceBundle('en', 'fail')).toEqual({});
          expect(connector.store.getResourceBundle('en', 'fail')).toEqual(undefined);
          resolve();
        });
      });
    });
  });
});

describe('BackendConnector load all fail - 10 namespaces', () => {
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
      'should call callback on complete failure - taking no longer than 1 namespace',
      { timeout: 12000 },
      () => {
        expect.assertions(2);
        return new Promise((resolve) => {
          connector.load(
            ['en'],
            [
              'fail1',
              'fail2',
              'fail3',
              'fail4',
              'fail5',
              'fail6',
              'fail7',
              'fail8',
              'fail9',
              'fail10',
            ],
            (err) => {
              expect(err).toEqual([
                'failed loading',
                'failed loading',
                'failed loading',
                'failed loading',
                'failed loading',
                'failed loading',
                'failed loading',
                'failed loading',
                'failed loading',
                'failed loading',
              ]);
              // expect(connector.store.getResourceBundle('en', 'fail1')).toEqual({});
              expect(connector.store.getResourceBundle('en', 'fail1')).toEqual(undefined);
              resolve();
            },
          );
        });
      },
    );
  });
});

describe('BackendConnector load only one succeeds', () => {
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
    it('should call callback', { timeout: 12000 }, () => {
      expect.assertions(4);
      return new Promise((resolve) => {
        connector.load(['en'], ['fail', 'fail2', 'concurrently'], (err) => {
          expect(err).toEqual(['failed loading', 'failed loading']);
          // expect(connector.store.getResourceBundle('en', 'fail')).toEqual({});
          expect(connector.store.getResourceBundle('en', 'fail')).toEqual(undefined);
          // expect(connector.store.getResourceBundle('en', 'fail2')).toEqual({});
          expect(connector.store.getResourceBundle('en', 'fail2')).toEqual(undefined);
          expect(connector.store.getResourceBundle('en', 'concurrently')).toEqual({
            status: 'ok',
            namespace: 'concurrently',
          });
          resolve();
        });
      });
    });
  });
});

describe('BackendConnector load only one succeeds with retries', () => {
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
    it('should call callback', { timeout: 12000 }, () => {
      expect.assertions(5);
      return new Promise((resolve) => {
        connector.load(['en'], ['fail', 'fail2', 'concurrently', 'retry2'], (err) => {
          expect(err).toEqual(['failed loading', 'failed loading']);
          // expect(connector.store.getResourceBundle('en', 'fail')).toEqual({});
          expect(connector.store.getResourceBundle('en', 'fail')).toEqual(undefined);
          // expect(connector.store.getResourceBundle('en', 'fail2')).toEqual({});
          expect(connector.store.getResourceBundle('en', 'fail2')).toEqual(undefined);
          expect(connector.store.getResourceBundle('en', 'concurrently')).toEqual({
            status: 'ok',
            namespace: 'concurrently',
          });
          expect(connector.store.getResourceBundle('en', 'retry2')).toEqual({
            status: 'nok',
            retries: 2,
          });
          resolve();
        });
      });
    });
  });
});

describe('BackendConnector reload retry', () => {
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

  describe('#reload', () => {
    it('should reload data', () => {
      connector.reload(['es'], ['noretry'], () => {});
      expect(connector.store.getResourceBundle('es', 'noretry')).toEqual({
        status: 'nok',
        retries: 0,
      });
    });
  });
});

describe('BackendConnector retry with default maxRetries=5', () => {
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
        // retryTimeout: 350,   // This is the default value
        // maxRetries: 5,       // This is the default value
        backend: { loadPath: 'http://localhost:9876/locales/{{lng}}/{{ns}}.json' },
      },
    );
  });

  describe('#load', () => {
    it('retry 1 time', { timeout: 10850 }, () => {
      expect.assertions(1);
      return new Promise((resolve) => {
        connector.load(['en'], ['retry1'], () => {
          expect(connector.store.getResourceBundle('en', 'retry1')).toEqual({
            status: 'nok',
            retries: 1,
          });
          resolve();
        });
      });
    });

    it(
      'retry 5 times',
      {
        // ((2^5) - 1) * 350 = 10850
        timeout: 10850 + 250,
      },
      () => {
        expect.assertions(1);
        return new Promise((resolve) => {
          connector.load(['en'], ['retry5'], () => {
            expect(connector.store.getResourceBundle('en', 'retry5')).toEqual({
              status: 'nok',
              retries: 5,
            });
            resolve();
          });
        });
      },
    );

    it(
      'fail after retrying 5 times',
      {
        // ((2^5) - 1) * 350 = 10850
        timeout: 10850 + 250,
      },
      () => {
        expect.assertions(2);
        return new Promise((resolve) => {
          connector.load(['en'], ['retry6'], (err) => {
            expect(err).toEqual(['failed loading']);
            // expect(connector.store.getResourceBundle('en', 'retry6')).toEqual({});
            expect(connector.store.getResourceBundle('en', 'retry6')).toEqual(undefined);
            resolve();
          });
        });
      },
    );
  });
});

describe('BackendConnector retry with maxRetries=6', () => {
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
        // retryTimeout: 350,   // This is the default value
        maxRetries: 6,
        backend: { loadPath: 'http://localhost:9876/locales/{{lng}}/{{ns}}.json' },
      },
    );
  });

  describe('#load', () => {
    it('retry 1 time', { timeout: 10850 }, () => {
      expect.assertions(1);
      return new Promise((resolve) => {
        connector.load(['en'], ['retry1'], () => {
          expect(connector.store.getResourceBundle('en', 'retry1')).toEqual({
            status: 'nok',
            retries: 1,
          });
          resolve();
        });
      });
    });

    it(
      'retry 5 times',
      {
        // ((2^5) - 1) * 350 = 10850
        timeout: 10850 + 250,
      },
      () => {
        expect.assertions(1);
        return new Promise((resolve) => {
          connector.load(['en'], ['retry5'], () => {
            expect(connector.store.getResourceBundle('en', 'retry5')).toEqual({
              status: 'nok',
              retries: 5,
            });
            resolve();
          });
        });
      },
    );

    it(
      'retry 6 times',
      {
        // ((2^6) - 1) * 350 = 22050
        timeout: 22050 + 250,
      },
      () => {
        expect.assertions(1);
        return new Promise((resolve) => {
          connector.load(['en'], ['retry6'], () => {
            expect(connector.store.getResourceBundle('en', 'retry6')).toEqual({
              status: 'nok',
              retries: 6,
            });
            resolve();
          });
        });
      },
    );

    it(
      'fail after retrying 6 times',
      {
        // ((2^6) - 1) * 350 = 22050
        timeout: 22050 + 250,
      },
      () => {
        expect.assertions(2);
        return new Promise((resolve) => {
          connector.load(['en'], ['retry7'], (err) => {
            expect(err).toEqual(['failed loading']);
            // expect(connector.store.getResourceBundle('en', 'retry7')).toEqual({});
            expect(connector.store.getResourceBundle('en', 'retry7')).toEqual(undefined);
            resolve();
          });
        });
      },
    );
  });
});

// All tests have 250ms of code-execution buffer time built in.
// To ensure test correctness, the tests should never time out.
describe('BackendConnector retry with shorter intervals', () => {
  let connector;

  beforeAll(() => {
    connector = new BackendConnector(
      new BackendMock(),
      new ResourceStore(),
      {
        interpolator: new Interpolator(),
      },
      {
        retryTimeout: 100,
        backend: { loadPath: 'http://localhost:9876/locales/{{lng}}/{{ns}}.json' },
      },
    );
  });

  describe('#load', () => {
    it(
      'retry 1 time',
      {
        timeout: 100 + 250,
      },
      () => {
        expect.assertions(1);
        return new Promise((resolve) => {
          connector.load(['en'], ['retry1'], () => {
            expect(connector.store.getResourceBundle('en', 'retry1')).toEqual({
              status: 'nok',
              retries: 1,
            });
            resolve();
          });
        });
      },
    );

    it(
      'retry 5 times',
      {
        // ((2^5) - 1) * 100 = 3100
        timeout: 3100 + 250,
      },
      () => {
        expect.assertions(1);
        return new Promise((resolve) => {
          connector.load(['en'], ['retry5'], () => {
            expect(connector.store.getResourceBundle('en', 'retry5')).toEqual({
              status: 'nok',
              retries: 5,
            });
            resolve();
          });
        });
      },
    );
  });
});

describe('BackendConnector retry with default maxRetries=0', () => {
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
        // retryTimeout: 350,   // This is the default value
        maxRetries: 0, // This is the default value
        backend: { loadPath: 'http://localhost:9876/locales/{{lng}}/{{ns}}.json' },
      },
    );
  });

  describe('#load', () => {
    it(
      'succeeds',
      {
        timeout: 10850,
      },
      async () => {
        const callback = vitest.fn();

        connector.load(['en'], ['concurrently'], callback);

        await vitest.waitFor(() => expect(callback).toHaveBeenCalledWith());
        await vitest.waitFor(() =>
          expect(connector.store.getResourceBundle('en', 'concurrently')).toEqual({
            status: 'ok',
            namespace: 'concurrently',
          }),
        );
      },
    );

    it(
      'does not retry',
      {
        timeout: 10850,
      },
      async () => {
        const callback = vitest.fn();

        connector.load(['en'], ['retry0'], callback);

        await vitest.waitFor(() => expect(callback).toHaveBeenCalled());

        expect(callback).toHaveBeenCalledWith(['failed loading']);
        // expect(connector.store.getResourceBundle('en', 'retry0')).toEqual({});
        expect(connector.store.getResourceBundle('en', 'retry0')).toEqual(undefined);
      },
    );
  });
});
