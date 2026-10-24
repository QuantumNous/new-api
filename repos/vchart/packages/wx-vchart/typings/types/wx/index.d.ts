/*! *****************************************************************************
Copyright (c) 2023 Tencent, Inc. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
***************************************************************************** */

/// <reference path="./lib.wx.app.d.ts" />
/// <reference path="./lib.wx.page.d.ts" />
/// <reference path="./lib.wx.api.d.ts" />
/// <reference path="./lib.wx.cloud.d.ts" />
/// <reference path="./lib.wx.canvas.d.ts" />
/// <reference path="./lib.wx.component.d.ts" />
/// <reference path="./lib.wx.behavior.d.ts" />
/// <reference path="./lib.wx.event.d.ts" />

declare namespace WechatMiniprogram {
  type IAnyObject = Record<string, any>;
  type Optional<F> = F extends (arg: infer P) => infer R ? (arg?: P) => R : F;
  type OptionalInterface<T> = { [K in keyof T]: Optional<T[K]> };
  interface AsyncMethodOptionLike {
    success?: (...args: any[]) => void;
  }
  type PromisifySuccessResult<P, T extends AsyncMethodOptionLike> = P extends {
    success: any;
  }
    ? void
    : P extends { fail: any }
    ? void
    : P extends { complete: any }
    ? void
    : Promise<Parameters<Exclude<T['success'], undefined>>[0]>;

  //  TODO: Extract real definition from `lib.dom.d.ts` to replace this
  type IIRFilterNode = any;
  type WaveShaperNode = any;
  type ConstantSourceNode = any;
  type OscillatorNode = any;
  type GainNode = any;
  type BiquadFilterNode = any;
  type PeriodicWaveNode = any;
  type BufferSourceNode = any;
  type ChannelSplitterNode = any;
  type ChannelMergerNode = any;
  type DelayNode = any;
  type DynamicsCompressorNode = any;
  type ScriptProcessorNode = any;
  type PannerNode = any;
  type AnalyserNode = any;
  type AudioListener = any;
  type WebGLTexture = any;
  type WebGLRenderingContext = any;

  // TODO: fill worklet type
  type WorkletFunction = (...args: any) => any;
  type AnimationObject = any;
  type SharedValue<T = any> = T;
  type DerivedValue<T = any> = T;
}

declare let console: WechatMiniprogram.Console;

declare let wx: WechatMiniprogram.Wx;
/** 引入模块。返回模块通过 `module.exports` 或 `exports` 暴露的接口。 */
interface Require {
  (
    /** 需要引入模块文件相对于当前文件的相对路径，或 npm 模块名，或 npm 模块路径。不支持绝对路径 */
    module: string,
    /** 用于异步获取其他分包中的模块的引用结果，详见 [分包异步化]((subpackages/async)) */
    callback?: (moduleExport: any) => void,
    /** 异步获取分包失败时的回调，详见 [分包异步化]((subpackages/async)) */
    errorCallback?: (err: any) => void
  ): any;
  /** 以 Promise 形式异步引入模块。返回模块通过 `module.exports` 或 `exports` 暴露的接口。 */
  async(
    /** 需要引入模块文件相对于当前文件的相对路径，或 npm 模块名，或 npm 模块路径。不支持绝对路径 */
    module: string
  ): Promise<any>;
}
declare const require: Require;
/** 引入插件。返回插件通过 `main` 暴露的接口。 */
interface RequirePlugin {
  (
    /** 需要引入的插件的 alias */
    module: string,
    /** 用于异步获取其他分包中的插件的引用结果，详见 [分包异步化]((subpackages/async)) */
    callback?: (pluginExport: any) => void
  ): any;
  /** 以 Promise 形式异步引入插件。返回插件通过 `main` 暴露的接口。 */
  async(
    /** 需要引入的插件的 alias */
    module: string
  ): Promise<any>;
}
declare const requirePlugin: RequirePlugin;
/** 插件引入当前使用者小程序。返回使用者小程序通过 [插件配置中 `export` 暴露的接口](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/using.html#%E5%AF%BC%E5%87%BA%E5%88%B0%E6%8F%92%E4%BB%B6)。
 *
 * 该接口只在插件中存在
 *
 * 最低基础库： `2.11.1` */
declare function requireMiniProgram(): any;
/** 当前模块对象 */
declare let module: {
  /** 模块向外暴露的对象，使用 `require` 引用该模块时可以获取 */
  exports: any;
};
/** `module.exports` 的引用 */
declare let exports: any;

/** [clearInterval(number intervalID)](https://developers.weixin.qq.com/miniprogram/dev/api/base/timer/clearInterval.html)
 *
 * 取消由 setInterval 设置的定时器。 */
declare function clearInterval(
  /** 要取消的定时器的 ID */
  intervalID: number
): void;
/** [clearTimeout(number timeoutID)](https://developers.weixin.qq.com/miniprogram/dev/api/base/timer/clearTimeout.html)
 *
 * 取消由 setTimeout 设置的定时器。 */
declare function clearTimeout(
  /** 要取消的定时器的 ID */
  timeoutID: number
): void;
/** [number setInterval(function callback, number delay, any rest)](https://developers.weixin.qq.com/miniprogram/dev/api/base/timer/setInterval.html)
 *
 * 设定一个定时器。按照指定的周期（以毫秒计）来执行注册的回调函数 */
declare function setInterval(
  /** 回调函数 */
  callback: (...args: any[]) => any,
  /** 执行回调函数之间的时间间隔，单位 ms。 */
  delay?: number,
  /** param1, param2, ..., paramN 等附加参数，它们会作为参数传递给回调函数。 */
  rest?: any
): number;
/** [number setTimeout(function callback, number delay, any rest)](https://developers.weixin.qq.com/miniprogram/dev/api/base/timer/setTimeout.html)
 *
 * 设定一个定时器。在定时到期以后执行注册的回调函数 */
declare function setTimeout(
  /** 回调函数 */
  callback: (...args: any[]) => any,
  /** 延迟的时间，函数的调用会在该延迟之后发生，单位 ms。 */
  delay?: number,
  /** param1, param2, ..., paramN 等附加参数，它们会作为参数传递给回调函数。 */
  rest?: any
): number;
