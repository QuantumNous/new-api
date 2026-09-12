import { getTestStage } from './stage';

export const getTestCompiler = () =>
  ({
    updateData: () => {},
    updateState: () => {},
    renderAsync: () => {},
    getLayoutState: () => '',
    updateLayoutTag: () => {},
    getStage: getTestStage,
    addRootMark: () => {},
    renderNextTick: () => {},
    addGrammarItem: () => {}
  } as any);
