import React from 'react';
import { Locale } from './interface';

const LocaleContext = React.createContext<Locale>(null);
export default LocaleContext;