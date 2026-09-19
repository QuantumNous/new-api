export type InterpolateType =
  | 'basis'
  | 'linear'
  | 'monotone'
  | 'monotoneX'
  | 'monotoneY'
  | 'step'
  | 'stepAfter'
  | 'stepBefore'
  | 'linearClosed'
  | 'catmullRom'
  | 'catmullRomClosed';

export const DEFAULT_SMOOTH_INTERPOLATE = 'monotone';
export const DEFAULT_LINEAR_INTERPOLATE = 'linear';
