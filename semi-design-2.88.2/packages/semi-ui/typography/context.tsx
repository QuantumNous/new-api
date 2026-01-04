import React from 'react';
import { TypographyBaseSize } from './interface';

const SizeContext = React.createContext<TypographyBaseSize>('normal');

export default SizeContext;