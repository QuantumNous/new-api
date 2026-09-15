import * as React from 'react';
import { expect } from 'vitest';
import type {
  ConformantComponentProps,
  BaseUiConformanceTestsOptions,
} from '../describeConformance';
import { throwMissingPropError } from './utils';

async function verifyRef(
  element: React.ReactElement<ConformantComponentProps>,
  render: BaseUiConformanceTestsOptions['render'],
  onRef: (instance: unknown, element: HTMLElement | null) => void,
) {
  if (!render) {
    throwMissingPropError('render');
  }

  const ref = React.createRef();

  const { container } = await render(
    <React.Fragment>{React.cloneElement(element, { ref })}</React.Fragment>,
  );

  onRef(ref.current, container);
}

export function testRefForwarding(
  element: React.ReactElement<ConformantComponentProps>,
  getOptions: () => BaseUiConformanceTestsOptions,
) {
  describe('ref', () => {
    it(`attaches the ref`, async () => {
      const { render, refInstanceof } = getOptions();

      await verifyRef(element, render, (instance) => {
        expect(instance).toBeInstanceOf(refInstanceof);
      });
    });
  });
}
