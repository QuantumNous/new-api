import { describe, it, expectTypeOf } from 'vitest';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';

describe('<I18nextProvider />', () => {
  it('basic usage', () => {
    expectTypeOf(I18nextProvider).toBeCallableWith({
      i18n: i18next,
      children: 'Foo',
    });
  });

  it('should accept `defaultNS`', () => {
    expectTypeOf(I18nextProvider).toBeCallableWith({
      i18n: i18next,
      defaultNS: 'defaultNS',
      children: 'Foo',
    });
  });
});
