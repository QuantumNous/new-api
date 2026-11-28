import { CSSProperties } from 'react';

export const style_cs_canvas: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
  margin: '0px',
  position: 'relative',
  zIndex: 1
};

export const style_cs_canvas_hidden: CSSProperties = {
  opacity: 0,
  visibility: 'hidden',
  width: '100%',
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  top: 0,
  left: 0,
  zIndex: 0
};

export const style_cs_tooltip_canvas: CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'absolute',
  // pointerEvents: 'none',
  top: 0,
  left: 0,
  zIndex: 2
};

export const style_container: CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative'
};
