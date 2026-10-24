import React from 'react';
import { mount } from 'enzyme';
import ComponentUseTranslation from './UseTranslation';

it('test render', () => {
  const mounted = mount(<ComponentUseTranslation />);

  // console.log(mounted.debug());
  expect(mounted.contains(<div>description.part2</div>)).toBe(true);
});
