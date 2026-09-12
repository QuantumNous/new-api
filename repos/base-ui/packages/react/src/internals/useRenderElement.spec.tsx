/* eslint-disable react-hooks/rules-of-hooks */
import * as React from 'react';
import { expectType } from '#test-utils';
import { useRenderElement } from './useRenderElement';

const element1 = useRenderElement('div', {}, {});

expectType<React.ReactElement, typeof element1>(element1);

const element2 = useRenderElement(
  'div',
  {},
  {
    enabled: true,
  },
);

expectType<React.ReactElement, typeof element2>(element2);

const element3 = useRenderElement(
  'div',
  {},
  {
    enabled: false,
  },
);

expectType<null, typeof element3>(element3);

const element4 = useRenderElement(
  'div',
  {},
  {
    enabled: Math.random() > 0.5,
  },
);

expectType<React.ReactElement | null, typeof element4>(element4);
