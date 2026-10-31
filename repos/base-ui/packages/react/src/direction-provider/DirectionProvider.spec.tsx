import * as React from 'react';
import { expectType } from '#test-utils';
import {
  DirectionProvider,
  useDirection,
  type DirectionProviderProps,
  type TextDirection,
} from '@base-ui/react/direction-provider';

const direction = null as unknown as ReturnType<typeof useDirection>;

expectType<TextDirection, typeof direction>(direction);

const props: DirectionProviderProps = {
  direction: 'rtl',
  children: <div />,
};

expectType<TextDirection | undefined, typeof props.direction>(props.direction);

<DirectionProvider />;
<DirectionProvider direction="ltr" />;
<DirectionProvider direction="rtl" />;

const invalidDirection = (
  // @ts-expect-error
  <DirectionProvider direction="vertical" />
);
