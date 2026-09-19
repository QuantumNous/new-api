import { describe, it, expectTypeOf } from 'vitest';
import { Translation } from 'react-i18next';

describe('<Translation />', () => {
  it('should work with default namespace', () => {
    expectTypeOf(Translation).toBeCallableWith({ children: (t) => t('foo') });
  });

  it('should work with named default namespace', () => {
    expectTypeOf(Translation<'custom'>).toBeCallableWith({ children: (t) => t('foo') });
  });

  it('should work with named namespace', () => {
    expectTypeOf(Translation<'alternate'>).toBeCallableWith({ children: (t) => t('baz') });
  });

  it('should work with namespace array', () => {
    expectTypeOf(Translation<['alternate', 'custom']>).toBeCallableWith({
      children: (t) => `${t('alternate:baz')} ${t('custom:foo')}`,
    });
  });

  it('should throw error when namespace does not exist', () => {
    // @ts-expect-error
    expectTypeOf(Translation<'fake'>).toBeFunction();
  });

  it('should throw error when namespace does not contain given `t` key', () => {
    expectTypeOf(Translation<'custom'>).toBeCallableWith({
      // @ts-expect-error
      children: (t) => t('fake'),
    });
  });

  it('should throw error when namespace does not contain given `t` key (with namespace as prefix)', () => {
    expectTypeOf(Translation<'custom'>).toBeCallableWith({
      // @ts-expect-error
      children: (t) => t('custom:fake'),
    });
  });
});
