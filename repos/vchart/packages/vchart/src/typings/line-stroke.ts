// somehow？ 使用 vrender 的声明文件会 build 报错
// import { LineJoinType, LineCapType } from '@visactor/vrender-core';
export type ILineStrokeCap = 'butt' | 'round' | 'square';
export type ILineStrokeJoin = 'arcs' | 'bevel' | 'miter' | 'miter-clip' | 'round';

export const DEFAULT_CLOSE_STROKE_JOIN = 'bevel';
