import React from 'react';
import { mount } from 'enzyme';
import UseTranslationWithInterpolation from './UseTranslationWithInterpolation';
import { useTranslation } from 'react-i18next';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

it('test render', () => {
  const useTranslationSpy = useTranslation;
  const tSpy = jest.fn((str) => str);
  useTranslationSpy.mockReturnValue({
    t: tSpy,
    i18n: {
      changeLanguage: () => new Promise(() => {}),
    },
  });

  const mounted = mount(<UseTranslationWithInterpolation />);

  // console.log(mounted.debug());
  expect(mounted.contains(<div>some.key</div>)).toBe(true);

  // If you want you can also check how the t function has been called,
  // but basically this is testing your mock and not the actual code.
  expect(tSpy).toHaveBeenCalledTimes(1);
  expect(tSpy).toHaveBeenLastCalledWith('some.key', { some: 'variable' });
});
