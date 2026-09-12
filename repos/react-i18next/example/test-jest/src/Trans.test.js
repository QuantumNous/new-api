import React from 'react';
import { mount } from 'enzyme';
import ComponentTrans from './Trans';

it('test render', () => {
  const mounted = mount(<ComponentTrans />);

  // console.log(mounted.debug());
  expect(mounted.contains(<strong>description.bold</strong>)).toBe(true);
});
