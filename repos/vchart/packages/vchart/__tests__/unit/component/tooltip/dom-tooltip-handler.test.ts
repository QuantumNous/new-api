import { DomTooltipHandler } from '../../../../src/plugin/components/tooltip-handler/dom-tooltip-handler';
import { TOOLTIP_CONTAINER_EL_CLASS_NAME } from '../../../../src/plugin/components/tooltip-handler/constants';
import { createDiv, removeDom } from '../../../util/dom';

const createTooltipSpec = (spec: any) => ({
  className: 'vchart-tooltip',
  style: {
    shape: {},
    keyLabel: {},
    valueLabel: {}
  },
  ...spec
});

const createHandler = (spec: any, chartContainer?: HTMLElement) => {
  const handler = new DomTooltipHandler() as any;

  handler._component = {
    getSpec: () => createTooltipSpec(spec)
  };
  handler._chartOption = {
    getTheme: (): undefined => undefined
  };
  handler._chartContainer = chartContainer;
  handler._initStyle();

  return handler as DomTooltipHandler;
};

describe('DomTooltipHandler', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createDiv();
  });

  afterEach(() => {
    removeDom(container);
  });

  it('falls back to chart container when tooltip parentElement is not a dom element', () => {
    const handler = createHandler(
      {
        parentElement: {}
      },
      container
    );

    expect(() => handler.initRootDom()).not.toThrow();
    expect(container.querySelector(`.${TOOLTIP_CONTAINER_EL_CLASS_NAME}`)).toBe(handler.getTooltipContainer());
    expect(container.querySelector('.vchart-tooltip')).toBe(handler.getRootDom());
  });

  it('creates tooltip container under an empty valid parentElement', () => {
    const parentElement = createDiv(container);
    const handler = createHandler({
      parentElement
    });

    handler.initEl();

    expect(parentElement.querySelector(`.${TOOLTIP_CONTAINER_EL_CLASS_NAME}`)).toBe(handler.getTooltipContainer());
  });
});
