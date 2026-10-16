export const GradientType = ['linear', 'radial', 'conical'];

export const DEFAULT_LINEAR_GRADIENT_CONFIG = {
  x0: 0,
  y0: 0,
  x1: 1,
  y1: 1
};

export const DEFAULT_RADIAL_GRADIENT_CONFIG = {
  x0: 0,
  y0: 0,
  x1: 1,
  y1: 1,
  r0: 0,
  r1: 1
};

export const DEFAULT_CONICAL_GRADIENT_CONFIG = {
  x: 0.5,
  y: 0.5,
  startAngle: 0,
  endAngle: Math.PI * 2
};

export const DEFAULT_GRADIENT_CONFIG = {
  linear: DEFAULT_LINEAR_GRADIENT_CONFIG,
  radial: DEFAULT_RADIAL_GRADIENT_CONFIG,
  conical: DEFAULT_CONICAL_GRADIENT_CONFIG
};
