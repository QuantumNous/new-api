import * as React from 'react';
import { Home } from './pages/Home';
import { LayoutWrap } from './Layout';

export default function App() {
  return (
    <LayoutWrap>
      <Home/>
    </LayoutWrap>
  );
}
