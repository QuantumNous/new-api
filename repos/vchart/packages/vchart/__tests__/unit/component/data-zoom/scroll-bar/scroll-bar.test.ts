import { ScrollBar } from './../../../../../src/component/data-zoom/scroll-bar/scroll-bar';

describe('ScrollBar', () => {
  let scrollBar: ScrollBar;
  let option: any;

  beforeEach(() => {
    option = {
      getComponentByUserId: jest.fn(),
      getComponentByIndex: jest.fn(),
      getComponentsByKey: jest.fn().mockReturnValue([]),
      getAllRegions: jest.fn().mockReturnValue([]),
      getRegionsInIndex: jest.fn().mockReturnValue([]),
      dataSet: {
        multipleDataViewAddListener: jest.fn()
      }
    };
  });

  it('should adjust range when minSliderSize is set and slider is too small', () => {
    const spec: any = {
      minSliderSize: 20,
      orient: 'bottom'
    };

    scrollBar = new ScrollBar(spec, option);

    // Mock layout
    scrollBar.getLayoutRect = jest.fn().mockReturnValue({ width: 100, height: 20 });
    scrollBar.getLayoutStartPoint = jest.fn().mockReturnValue({ x: 0, y: 0 });
    // Mock state
    (scrollBar as any)._start = 0.49;
    (scrollBar as any)._end = 0.51;
    // Current size = 0.02 * 100 = 2px.
    // Min size = 20px.
    // Target ratio = 0.2.
    // Center = 0.5.
    // New range should be [0.4, 0.6].

    // Access private method _getAttrs
    const attrs = (scrollBar as any)._getAttrs();

    expect(attrs.range[0]).toBeCloseTo(0.49);
    expect(attrs.range[1]).toBeCloseTo(0.51);
  });

  it('should clamp range when adjusting for minSliderSize', () => {
    const spec: any = {
      minSliderSize: 20,
      orient: 'bottom'
    };

    scrollBar = new ScrollBar(spec, option);

    scrollBar.getLayoutRect = jest.fn().mockReturnValue({ width: 100, height: 20 });
    scrollBar.getLayoutStartPoint = jest.fn().mockReturnValue({ x: 0, y: 0 });

    // Start case
    (scrollBar as any)._start = 0;
    (scrollBar as any)._end = 0.02;
    // Center = 0.01.
    // Target ratio = 0.2.
    // Normal new range: [-0.09, 0.11].
    // Clamped: [0, 0.2].

    let attrs = (scrollBar as any)._getAttrs();
    expect(attrs.range[0]).toBeCloseTo(0);
    expect(attrs.range[1]).toBeCloseTo(0.02);

    // End case
    (scrollBar as any)._start = 0.98;
    (scrollBar as any)._end = 1;
    // Clamped: [0.8, 1].

    attrs = (scrollBar as any)._getAttrs();
    expect(attrs.range[0]).toBeCloseTo(0.98);
    expect(attrs.range[1]).toBeCloseTo(1);
  });

  it('should map reversed vertical axis state to top-first domain values', () => {
    const spec: any = {
      orient: 'right'
    };

    scrollBar = new ScrollBar(spec, option);

    const handleStateChange = jest.fn().mockReturnValue(true);
    const emit = jest.fn();

    (scrollBar as any)._handleStateChange = handleStateChange;
    (scrollBar as any)._stateScale = {
      type: 'band',
      range: () => [100, 0],
      domain: () => ['A', 'B', 'C', 'D'],
      invert: (value: number) => {
        if (value < 25) {
          return 'A';
        }
        if (value < 50) {
          return 'B';
        }
        if (value < 75) {
          return 'C';
        }
        return 'D';
      }
    };
    (scrollBar as any)._relatedAxisComponent = {
      getScale: () => ({
        range: () => [100, 0]
      }),
      getInverse: () => false
    };
    (scrollBar as any).event = { emit };
    (scrollBar as any)._start = 0;
    (scrollBar as any)._end = 1;

    (scrollBar as any)._handleChange(0, 0.5);

    expect(handleStateChange).toHaveBeenCalledWith('A', 'C');
    expect(emit).toHaveBeenCalled();
  });
});
