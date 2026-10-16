import { expectType } from '#test-utils';
import { createToastManager } from './createToastManager';

type ToastPayload = {
  id: string;
  count: number;
};

const typedManager = createToastManager<ToastPayload>();

const typedAddId = typedManager.add({
  title: 'typed',
  data: {
    id: 'typed',
    count: 1,
  },
});
expectType<string, typeof typedAddId>(typedAddId);

typedManager.add({
  title: 'wrong-shape',
  data: {
    id: 'test',
    // @ts-expect-error - message is not a valid property
    message: 'not a number',
  },
});

typedManager.add({
  title: 'wrong-shape',
  // @ts-expect-error - count is a missing property
  data: {
    id: 'test',
  },
});

typedManager.update('typed', {
  data: {
    id: 'typed-update',
    count: 2,
  },
});

typedManager.promise(Promise.resolve(2), {
  loading: 'loading',
  success: (value) => ({
    title: `${value}`,
    data: {
      id: 'typed-success',
      count: value,
    },
  }),
  error: 'error',
});

const legacyManager = createToastManager();

const legacyAddId = legacyManager.add<ToastPayload>({
  title: 'legacy',
  data: {
    id: 'legacy',
    count: 3,
  },
});
expectType<string, typeof legacyAddId>(legacyAddId);

legacyManager.update<ToastPayload>('legacy', {
  data: {
    id: 'legacy-update',
    count: 4,
  },
});

legacyManager.promise<number, ToastPayload>(Promise.resolve(5), {
  loading: 'loading',
  success: (value) => ({
    title: `${value}`,
    data: {
      id: 'legacy-success',
      count: value,
    },
  }),
  error: 'error',
});
