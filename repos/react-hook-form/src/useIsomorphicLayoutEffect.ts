import React from 'react';

import isWeb from './utils/isWeb';

export const useIsomorphicLayoutEffect = isWeb
  ? React.useLayoutEffect
  : React.useEffect;
