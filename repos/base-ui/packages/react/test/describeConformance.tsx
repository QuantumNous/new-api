import * as React from 'react';
import {
  ConformanceOptions,
  MuiRenderResult,
  RenderOptions,
  createDescribe,
} from '@mui/internal-test-utils';
import { testPropForwarding } from './conformanceTests/propForwarding';
import { testRefForwarding } from './conformanceTests/refForwarding';
import { testRenderProp } from './conformanceTests/renderProp';
import { testClassName } from './conformanceTests/className';
import { BaseUIRenderResult } from './createRenderer';

export type ConformantComponentProps = {
  render?: React.ReactElement<unknown> | ((props: Record<string, unknown>) => React.ReactNode);
  ref?: React.Ref<unknown>;
  'data-testid'?: string;
  className?: string | ((state: unknown) => string);
  style?: React.CSSProperties;
  nativeButton?: boolean;
};

export interface BaseUiConformanceTestsOptions extends Omit<
  Partial<ConformanceOptions>,
  'render' | 'mount' | 'skip' | 'classes'
> {
  render: (
    element: React.ReactElement<
      ConformantComponentProps,
      string | React.JSXElementConstructor<any>
    >,
    options?: RenderOptions | undefined,
  ) => Promise<BaseUIRenderResult> | MuiRenderResult;
  skip?: (keyof typeof fullSuite)[];
  testRenderPropWith?: keyof React.JSX.IntrinsicElements;
  button?: boolean;
  /**
   * Whether the component is allowed to be wrapped by an extra element for testing.
   * @default true
   */
  wrappingAllowed?: boolean;
}

const fullSuite = {
  propsSpread: testPropForwarding,
  refForwarding: testRefForwarding,
  renderProp: testRenderProp,
  className: testClassName,
};

function describeConformanceFn(
  minimalElement: React.ReactElement<ConformantComponentProps>,
  getOptions: () => BaseUiConformanceTestsOptions,
) {
  const { after: runAfterHook = () => {}, only = Object.keys(fullSuite), skip = [] } = getOptions();

  const filteredTests = Object.keys(fullSuite).filter(
    (testKey) =>
      only.indexOf(testKey) !== -1 && skip.indexOf(testKey as keyof typeof fullSuite) === -1,
  ) as (keyof typeof fullSuite)[];

  afterAll(runAfterHook);

  filteredTests.forEach((testKey) => {
    const test = fullSuite[testKey];
    test(minimalElement, getOptions as any);
  });
}

export const describeConformance = createDescribe('Base UI component API', describeConformanceFn);
