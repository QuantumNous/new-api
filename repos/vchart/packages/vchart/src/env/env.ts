import {
  initAllEnv,
  loadBrowserEnv,
  loadFeishuEnv,
  loadLynxEnv,
  loadNodeEnv,
  loadTaroEnv,
  loadWxEnv,
  loadTTEnv,
  loadHarmonyEnv
} from '@visactor/vrender-kits/env';
import { container } from '@visactor/vrender-core/container';

/**
 * 加载所有环境兼容代码
 */
export const registerAllEnv = () => {
  initAllEnv();
};

/**
 * 加载浏览器环境代码
 */
export const registerBrowserEnv = () => {
  loadBrowserEnv(container);
};

/**
 * 加载飞书（飞书小程序/block/tt）环境代码
 */
export const registerLarkEnv = () => {
  // TODO: 后续统一为 loadLarkEnv
  loadFeishuEnv(container);
};

/**
 * 加载 Lynx 环境代码
 */
export const registerLynxEnv = () => {
  loadLynxEnv(container);
};

/**
 * 加载 Node 环境代码
 */
export const registerNodeEnv = () => {
  loadNodeEnv(container);
};

/**
 * 加载 Taro 环境代码
 */
export const registerTaroEnv = () => {
  loadTaroEnv(container);
};

/**
 * 加载微信小程序环境代码
 */
export const registerWXEnv = () => {
  loadWxEnv(container);
};
/**
 * 加载TT小程序环境代码
 */
export const registerTTEnv = () => {
  loadTTEnv(container);
};
/**
 * 加载Harmony环境代码
 */
export const registerHarmonyEnv = () => {
  loadHarmonyEnv(container);
};
