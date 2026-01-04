import React from 'react';
import WheelListDemo from './WheelList';
import ScrollListDemo from './ScrollList';
import SingleScrollListDemo from './SingleWheelList';


export default {
  title: 'ScrollList'
}

export const ScrollListSimple = () => {
  return <ScrollListDemo />;
};

ScrollListSimple.story = {
  name: 'ScrollList simple',
};

ScrollListSimple.parameters = {
  chromatic: { disableSnapshot: true },
}

export const _WheelListDemo = () => <WheelListDemo />;

_WheelListDemo.story = {
  name: 'wheel list demo',
};

export const SingleScrollList = () => <SingleScrollListDemo />;

SingleScrollList.story = {
  name: 'single scroll list demo',
};