import { installPoptipToApp, loadPoptip } from '@visactor/vrender-components/poptip';
import type { IApp } from '@visactor/vrender-core';
import { Factory } from '../../core/factory';

const installPoptip = (app?: IApp) => {
  if (app) {
    installPoptipToApp(app);
  } else {
    loadPoptip();
  }
};

export const registerPoptip = () => {
  Factory.registerRuntimePluginInstaller('poptipForText', installPoptip);
  installPoptip();
};
