import type { Ref } from '../types';

import isHTMLElement from './isHTMLElement';

export default (ref: Ref) => isHTMLElement(ref) && ref.isConnected;
