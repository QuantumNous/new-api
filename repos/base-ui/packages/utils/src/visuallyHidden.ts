import * as React from 'react';

const visuallyHiddenBase: React.CSSProperties = {
  clipPath: 'inset(50%)',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  border: 0,
  padding: 0,
  width: 1,
  height: 1,
  margin: -1,
};

export const visuallyHidden: React.CSSProperties = {
  ...visuallyHiddenBase,
  position: 'fixed',
  top: 0,
  left: 0,
};

export const visuallyHiddenInput: React.CSSProperties = {
  ...visuallyHiddenBase,
  position: 'absolute',
};
