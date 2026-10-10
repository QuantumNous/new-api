import React from 'react';
import { mount } from 'enzyme';
import ComponentTranslation from './Translation';

it('test render', () => {
  const mounted = mount(<ComponentTranslation />);

  // console.log(mounted.debug());
  expect(mounted.contains(<div>description.part4</div>)).toBe(true);
});
