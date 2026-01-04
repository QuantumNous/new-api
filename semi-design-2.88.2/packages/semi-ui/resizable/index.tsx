/**
 * reference:https://github.com/bokuweb/re-resizable
 * Resizable组件的api与功能代码均参考了v6.10.0,将逻辑部分放在Foundation中,react部分放在组件中
 * ResizeGroup的伸缩逻辑也有同上的参考
 */
import Resizable from "./single/resizable";
export {
    Resizable
};

import ResizeItem from "./group/resizeItem";
import ResizeHandler from "./group/resizeHandler";
import ResizeGroup from "./group/resizeGroup";

export {
    ResizeItem, 
    ResizeHandler,
    ResizeGroup
};