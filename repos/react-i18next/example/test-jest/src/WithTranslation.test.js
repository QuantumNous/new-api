import React from 'react';
import { mount } from 'enzyme';
import ComponentWithTranslation from './WithTranslation';

it('test render', () => {
  const mounted = mount(<ComponentWithTranslation />);

  // console.log(mounted.debug());
  expect(mounted.contains(<div>description.part3</div>)).toBe(true);
});
