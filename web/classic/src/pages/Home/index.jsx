import React from 'react';

import CNEntry from './cn-entry';
import ENEntry from './en-entry';

const HOME_ENTRY = (import.meta.env.VITE_HOME_ENTRY || 'en').toLowerCase();

const HomePage = () => {
  if (HOME_ENTRY === 'cn') {
    return <CNEntry />;
  }

  return <ENEntry />;
};

export default HomePage;
