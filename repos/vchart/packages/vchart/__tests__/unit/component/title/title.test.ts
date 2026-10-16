import { Title } from '../../../../src/component/title/title';
import { ComponentTypeEnum } from '../../../../src/component/interface/type';
import { getTheme } from '../../../util/context';

const ctx: any = {
  type: ComponentTypeEnum.title,
  eventDispatcher: { addEventListener: () => {} },
  mode: 'desktop-browser',
  globalInstance: {
    getContainer: () => ({}),
    getTooltipHandlerByUser: (): any => undefined,
    getStage: () => ({
      find: (): any => ({
        add: () => {}
      })
    })
  },
  getTheme: getTheme,
  getCompiler: () => ({}),
  getChart: () => ({
    getSpec: () => ({})
  }),
  getRegionsInIndex: (): any[] => []
};

describe('Title Component Repro', () => {
  it('should not throw error when only subtext is set', () => {
    const spec = {
      visible: true,
      subtext: 'This is a subtitle'
      // text is undefined
    };

    const title = new Title(spec as any, ctx);
    title.created();
    title.init({});

    // Simulate layout
    const layoutRect = { width: 500, height: 500, x: 0, y: 0 };

    expect(() => {
      title.getBoundsInRect(layoutRect);
    }).not.toThrow();
  });
});
